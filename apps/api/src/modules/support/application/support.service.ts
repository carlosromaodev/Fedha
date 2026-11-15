import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { notFound } from "../../../shared/errors/app-error";
import { ticketId, uuid } from "../../../shared/security/ids";
import { audit } from "../../../shared/audit/audit";
import { notify } from "../../notifications/application/notifications.service";

type Ticket = typeof schema.supportTickets.$inferSelect;

export const FAQ = [
  { q: "Como ligo o Fedha ao OBS?", a: "Em Overlay e alertas copia o teu link e adiciona-o como Navegador (Browser Source) com 1920×1080. Ativa \"Controlar áudio pelo OBS\"." },
  { q: "Posso recusar uma mensagem?", a: "Não. Cada mensagem paga toca automaticamente. O conteúdo é filtrado antes do pagamento (links, telefones, palavras bloqueadas)." },
  { q: "Quando posso levantar?", a: "O valor fica pendente até a mensagem tocar e passarem 48 horas. Depois fica disponível; levantas com KYC aprovado e 2FA ativo." },
  { q: "Quanto custa?", a: "A plataforma fica com 10% de cada mensagem (inclui o custo do pagamento). Cada levantamento tem uma taxa fixa de 300 Kz." },
  { q: "O doador é reembolsado se a mensagem não tocar?", a: "Sim, em caso de falha técnica ou se não tocar em 7 dias. Não há reembolso por conteúdo que já tocou." },
  { q: "Faço live só pelo telemóvel. Funciona?", a: "Sim. Com PRISM ou CameraFi Live tens o alerta no ecrã; pela app nativa do TikTok ou Instagram usa o Player (só áudio)." },
];

async function withMessages(ctx: Ctx, t: Ticket, includeInternal: boolean) {
  const msgs = await ctx.db.select().from(schema.supportMessages).where(eq(schema.supportMessages.ticketId, t.id)).orderBy(asc(schema.supportMessages.createdAt));
  return { ...view(t), messages: msgs.filter((m) => includeInternal || !m.internal).map((m) => ({ id: m.id, authorType: m.authorType, body: m.body, createdAt: m.createdAt.toISOString(), internal: m.internal })) };
}

function view(t: Ticket) {
  return {
    id: t.id, subject: t.subject, category: t.category, status: t.status as "open" | "in_progress" | "waiting_user" | "closed", priority: t.priority as "low" | "normal" | "high",
    orderId: t.orderId, assigneeId: t.assigneeId, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
  };
}

export async function createTicket(ctx: Ctx, userId: string | null, input: { subject: string; category: string; body: string; orderId?: string; priority?: string }) {
  const id = ticketId();
  const now = ctx.now();
  await ctx.db.insert(schema.supportTickets).values({ id, userId, subject: input.subject, category: input.category, orderId: input.orderId ?? null, priority: input.priority ?? (input.category === "refund" ? "high" : "normal"), createdAt: now, updatedAt: now });
  await ctx.db.insert(schema.supportMessages).values({ id: uuid(), ticketId: id, authorId: userId, authorType: userId ? "user" : "system", body: input.body, createdAt: now });
  return view((await ctx.db.query.supportTickets.findFirst({ where: eq(schema.supportTickets.id, id) }))!);
}

export async function myTickets(ctx: Ctx, userId: string) {
  return (await ctx.db.select().from(schema.supportTickets).where(eq(schema.supportTickets.userId, userId)).orderBy(desc(schema.supportTickets.updatedAt))).map(view);
}

export async function ticketFor(ctx: Ctx, id: string, userId: string | null) {
  const t = await ctx.db.query.supportTickets.findFirst({ where: eq(schema.supportTickets.id, id) });
  if (!t || (userId && t.userId !== userId)) throw notFound("Ticket");
  return withMessages(ctx, t, userId === null);
}

export async function reply(ctx: Ctx, id: string, author: { id: string; type: "user" | "admin" }, body: string, internal = false) {
  const t = await ctx.db.query.supportTickets.findFirst({ where: eq(schema.supportTickets.id, id) });
  if (!t || (author.type === "user" && t.userId !== author.id)) throw notFound("Ticket");
  const now = ctx.now();
  await ctx.db.insert(schema.supportMessages).values({ id: uuid(), ticketId: id, authorId: author.id, authorType: author.type, body, internal, createdAt: now });
  const status = author.type === "admin" ? (internal ? t.status : "waiting_user") : t.status === "closed" ? "open" : t.status === "waiting_user" ? "in_progress" : t.status;
  await ctx.db.update(schema.supportTickets).set({ status, updatedAt: now }).where(eq(schema.supportTickets.id, id));
  if (author.type === "admin" && !internal && t.userId) await notify(ctx, t.userId, "report_reviewed", `Resposta ao ticket ${t.id}`, body.slice(0, 140));
  if (author.type === "admin") await audit(ctx, { actorId: author.id, actorType: "admin", action: "support.reply", targetType: "ticket", targetId: id, data: { internal } });
  return ticketFor(ctx, id, null);
}

export async function adminList(ctx: Ctx, statuses?: string[]) {
  const rows = await ctx.db.select().from(schema.supportTickets).where(statuses?.length ? inArray(schema.supportTickets.status, statuses) : undefined).orderBy(desc(schema.supportTickets.updatedAt)).limit(500);
  return rows.map(view);
}

export async function adminUpdate(ctx: Ctx, id: string, patch: { status?: string; priority?: string; assigneeId?: string | null }, adminId: string) {
  const t = await ctx.db.query.supportTickets.findFirst({ where: eq(schema.supportTickets.id, id) });
  if (!t) throw notFound("Ticket");
  await ctx.db.update(schema.supportTickets).set({ ...patch, updatedAt: ctx.now() }).where(eq(schema.supportTickets.id, id));
  await audit(ctx, { actorId: adminId, actorType: "admin", action: "support.update", targetType: "ticket", targetId: id, data: patch });
  return ticketFor(ctx, id, null);
}

/** S2 — denunciar conteúdo abusivo ao suporte (a mensagem não é reembolsada). */
export async function reportContent(ctx: Ctx, streamerId: string, orderId: string, reason: string, actorId: string) {
  const o = await ctx.db.query.orders.findFirst({ where: and(eq(schema.orders.id, orderId), eq(schema.orders.streamerId, streamerId)) });
  if (!o) throw notFound("Mensagem");
  const id = uuid();
  await ctx.db.insert(schema.contentReports).values({ id, orderId, streamerId, reason, createdAt: ctx.now() });
  await audit(ctx, { actorId, actorType: "streamer", action: "content.reported", targetType: "order", targetId: orderId, streamerId });
  return { id };
}
