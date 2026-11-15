import { and, desc, eq } from "drizzle-orm";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { conflict, forbidden, notFound } from "../../../shared/errors/app-error";
import { secretToken, uuid } from "../../../shared/security/ids";
import { hashPassword } from "../../../shared/security/crypto";
import { audit } from "../../../shared/audit/audit";
import { streamerById, type Streamer } from "../../streamers/application/streamers.service";
import type { User } from "../../auth/application/auth.service";

type Link = typeof schema.assistantLinks.$inferSelect;

const inviteUrl = (ctx: Ctx, token: string) => `${ctx.env.PUBLIC_WEB_URL.replace(/\/$/, "")}/assistente/convite/${token}`;

function view(ctx: Ctx, a: Link) {
  return {
    id: a.id, name: a.name, contact: a.contact, status: a.status as "invited" | "active" | "removed",
    inviteUrl: a.status === "invited" ? inviteUrl(ctx, a.inviteToken) : null, createdAt: a.createdAt.toISOString(), acceptedAt: a.acceptedAt?.toISOString() ?? null,
  };
}

export async function listAssistants(ctx: Ctx, streamerId: string) {
  const rows = await ctx.db.select().from(schema.assistantLinks).where(eq(schema.assistantLinks.streamerId, streamerId)).orderBy(desc(schema.assistantLinks.createdAt));
  return rows.filter((r) => r.status !== "removed").map((r) => view(ctx, r));
}

/** S10 — convida por email ou telefone. O assistente só acompanha a fila e controla o Player. */
export async function invite(ctx: Ctx, s: Streamer, input: { name: string; contact: string }, actorId: string) {
  const contact = input.contact.includes("@") ? input.contact.toLowerCase() : input.contact.replace(/[\s.-]/g, "").replace(/^(\+?244)/, "");
  const id = uuid();
  const token = secretToken();
  await ctx.db.insert(schema.assistantLinks).values({ id, streamerId: s.id, name: input.name, contact, inviteToken: token, createdAt: ctx.now() });
  const msg = `${s.displayName} convidou-te para assistente no Fedha Live: ${inviteUrl(ctx, token)}`;
  if (contact.includes("@")) await ctx.messenger.email(contact, "Convite para assistente", msg);
  else await ctx.messenger.sms(contact, `Fedha Live: ${msg}`);
  await audit(ctx, { actorId, actorType: "streamer", action: "assistant.invited", targetType: "assistant", targetId: id, streamerId: s.id });
  return view(ctx, (await ctx.db.query.assistantLinks.findFirst({ where: eq(schema.assistantLinks.id, id) }))!);
}

export async function remove(ctx: Ctx, s: Streamer, id: string, actorId: string) {
  const a = await ctx.db.query.assistantLinks.findFirst({ where: and(eq(schema.assistantLinks.id, id), eq(schema.assistantLinks.streamerId, s.id)) });
  if (!a) throw notFound("Assistente");
  await ctx.db.update(schema.assistantLinks).set({ status: "removed", removedAt: ctx.now() }).where(eq(schema.assistantLinks.id, id));
  await audit(ctx, { actorId, actorType: "streamer", action: "assistant.removed", targetType: "assistant", targetId: id, streamerId: s.id });
}

/** Registo de ações de um assistente neste streamer. */
export async function actions(ctx: Ctx, s: Streamer, id: string) {
  const a = await ctx.db.query.assistantLinks.findFirst({ where: and(eq(schema.assistantLinks.id, id), eq(schema.assistantLinks.streamerId, s.id)) });
  if (!a) throw notFound("Assistente");
  if (!a.userId) return [];
  const rows = await ctx.db.select().from(schema.auditLog)
    .where(and(eq(schema.auditLog.actorId, a.userId), eq(schema.auditLog.streamerId, s.id))).orderBy(desc(schema.auditLog.createdAt)).limit(200);
  return rows.map((r) => ({ id: r.id, action: r.action, data: r.data, at: r.createdAt.toISOString() }));
}

async function byToken(ctx: Ctx, token: string) {
  const a = await ctx.db.query.assistantLinks.findFirst({ where: eq(schema.assistantLinks.inviteToken, token) });
  if (!a || a.status === "removed") throw notFound("Convite");
  return a;
}

export async function inviteInfo(ctx: Ctx, token: string) {
  const a = await byToken(ctx, token);
  const s = await streamerById(ctx, a.streamerId);
  const existing = await ctx.db.query.users.findFirst({ where: a.contact.includes("@") ? eq(schema.users.email, a.contact) : eq(schema.users.phone, a.contact) });
  return { streamer: { handle: s.handle, displayName: s.displayName }, name: a.name, status: a.status, hasAccount: !!existing };
}

/**
 * Aceitar o convite. Com sessão de assistente: liga a conta. Sem conta: cria a conta de assistente
 * com o contacto do convite (já verificado por ter recebido o link) e a palavra-passe indicada.
 */
export async function accept(ctx: Ctx, token: string, current: User | null, input: { displayName?: string; password?: string }) {
  const a = await byToken(ctx, token);
  if (a.status === "active") throw conflict("already_accepted", "Este convite já foi aceite.");
  let userId: string;
  let created = false;
  if (current) {
    if (current.role !== "assistant") throw forbidden("Entra com uma conta de assistente para aceitar o convite.");
    userId = current.id;
  } else {
    if (!input.password || !input.displayName) throw conflict("account_required", "Escolhe um nome e uma palavra-passe para criar a conta.");
    const isEmail = a.contact.includes("@");
    const exists = await ctx.db.query.users.findFirst({ where: isEmail ? eq(schema.users.email, a.contact) : eq(schema.users.phone, a.contact) });
    if (exists) throw conflict("login_required", "Já existe uma conta com este contacto. Entra primeiro.");
    userId = uuid();
    const now = ctx.now();
    await ctx.db.insert(schema.users).values({
      id: userId, role: "assistant", displayName: input.displayName, email: isEmail ? a.contact : `assistente+${userId}@fedha.invalid`, phone: isEmail ? null : a.contact,
      passwordHash: await hashPassword(input.password), emailVerifiedAt: isEmail ? now : null, phoneVerifiedAt: isEmail ? null : now, createdAt: now, updatedAt: now,
    });
    created = true;
  }
  await ctx.db.update(schema.assistantLinks).set({ status: "active", userId, acceptedAt: ctx.now() }).where(eq(schema.assistantLinks.id, a.id));
  await audit(ctx, { actorId: userId, actorType: "assistant", action: "assistant.accepted", streamerId: a.streamerId });
  return { userId, created };
}

export async function streamersOf(ctx: Ctx, userId: string) {
  const rows = await ctx.db.select().from(schema.assistantLinks).where(and(eq(schema.assistantLinks.userId, userId), eq(schema.assistantLinks.status, "active")));
  const out = [];
  for (const r of rows) {
    const s = await streamerById(ctx, r.streamerId);
    if (s.status === "active") out.push({ id: s.id, handle: s.handle, displayName: s.displayName, avatarUrl: s.avatarUrl });
  }
  return out;
}

export async function assertAssistantOf(ctx: Ctx, userId: string, streamerId: string) {
  const link = await ctx.db.query.assistantLinks.findFirst({ where: and(eq(schema.assistantLinks.userId, userId), eq(schema.assistantLinks.streamerId, streamerId), eq(schema.assistantLinks.status, "active")) });
  if (!link) throw forbidden("Não és assistente deste streamer.");
  return streamerById(ctx, streamerId);
}
