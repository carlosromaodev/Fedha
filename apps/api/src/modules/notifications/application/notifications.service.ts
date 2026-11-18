import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { uuid } from "../../../shared/security/ids";
import { DEFAULT_PREFS } from "../../auth/application/auth.service";

export type NotifyEvent = keyof typeof DEFAULT_PREFS;

export async function getPrefs(ctx: Ctx, userId: string): Promise<Record<string, string[]>> {
  const row = await ctx.db.query.notificationPrefs.findFirst({ where: eq(schema.notificationPrefs.userId, userId) });
  return { ...DEFAULT_PREFS, ...(row?.prefs ?? {}) };
}

export async function setPrefs(ctx: Ctx, userId: string, prefs: Record<string, string[]>) {
  const merged = { ...(await getPrefs(ctx, userId)), ...prefs };
  await ctx.db.insert(schema.notificationPrefs).values({ userId, prefs: merged })
    .onConflictDoUpdate({ target: schema.notificationPrefs.userId, set: { prefs: merged } });
  return merged;
}

/**
 * Guarda a notificação (aparece no painel) e envia pelos canais escolhidos para esse evento.
 * "push" chega ao painel aberto por WebSocket; push móvel fica para a app (fase 2).
 */
export async function notify(ctx: Ctx, userId: string, event: NotifyEvent, title: string, body: string, data?: Record<string, unknown>) {
  const user = await ctx.db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user || user.status === "deleted") return;
  const channels = (await getPrefs(ctx, userId))[event] ?? [];
  const id = uuid();
  await ctx.db.insert(schema.notifications).values({ id, userId, event, title, body, data: data ?? null, channels, createdAt: ctx.now() });
  const text = `Fedha Live: ${title}. ${body}`;
  const sends: Promise<unknown>[] = [];
  if (channels.includes("email")) sends.push(ctx.messenger.email(user.email, title, body));
  if (channels.includes("sms") && user.phone) sends.push(ctx.messenger.sms(user.phone, text));
  if (channels.includes("whatsapp") && user.phone) sends.push(ctx.messenger.whatsapp(`+244${user.phone}`, text));
  const results = await Promise.allSettled(sends);
  for (const r of results) if (r.status === "rejected") ctx.log.error({ err: r.reason, userId, event }, "falha a enviar notificação");
  const s = await ctx.db.query.streamers.findFirst({ where: eq(schema.streamers.userId, userId) });
  if (s) ctx.hub.publishDashboard(s.id, "notification", { id, event, title, body });
}

export async function notifyStreamer(ctx: Ctx, streamerId: string, event: NotifyEvent, title: string, body: string, data?: Record<string, unknown>) {
  const s = await ctx.db.query.streamers.findFirst({ where: eq(schema.streamers.id, streamerId) });
  if (s) await notify(ctx, s.userId, event, title, body, data);
}

export async function listNotifications(ctx: Ctx, userId: string, limit = 50) {
  const rows = await ctx.db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId)).orderBy(desc(schema.notifications.createdAt)).limit(limit);
  return rows.map((n) => ({ id: n.id, event: n.event, title: n.title, body: n.body, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }));
}

export async function markRead(ctx: Ctx, userId: string, ids?: string[]) {
  await ctx.db.update(schema.notifications).set({ readAt: ctx.now() })
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt), ids?.length ? inArray(schema.notifications.id, ids) : undefined));
}
