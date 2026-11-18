import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { OutputsStatus, QueueItemView, QueueSnapshot } from "@fedha/contracts";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { sortQueue } from "../domain/ordering";
import { streamerById, type Streamer } from "../../streamers/application/streamers.service";
import { appFromUserAgent, warningFor } from "../../playback/application/widgets.service";

type Order = typeof schema.orders.$inferSelect;

export const maskPhone = (p: string | null) => (p ? `${p.slice(0, 3)} ••• ${p.slice(-3)}` : null);

export function tagsOf(o: Order, voiceName?: string | null, effectName?: string | null): string[] {
  const t: string[] = [];
  if (o.priority) t.push("Prioridade");
  if (o.lines.some((l) => l.label === "Voz premium")) t.push(`Voz premium${voiceName ? ` · ${voiceName}` : ""}`);
  if (o.effectId) t.push(`Efeito · ${effectName ?? o.effectId}`);
  if (o.kind === "audio" && o.audioTierSeconds) t.push(`Áudio ${o.audioTierSeconds} s`);
  if (o.playCount > 1) t.push(`Repetida ${o.playCount - 1}×`);
  return t;
}

export function itemView(ctx: Ctx, o: Order, position: number | null): QueueItemView {
  return {
    id: o.id, donorName: o.donorName, donorPhoneMasked: maskPhone(o.donorPhone), kind: o.kind as "text" | "audio", text: o.text,
    durationMs: o.durationMs, amount: o.amount, tags: tagsOf(o), priority: o.priority,
    status: o.status as "queued" | "playing" | "played", position, paidAt: o.paidAt?.toISOString() ?? null, playedAt: o.playedAt?.toISOString() ?? null,
    audioUrl: o.audioKey ? ctx.storage.publicUrl(o.audioKey) : null,
  };
}

export async function queuedOrders(ctx: Ctx, s: Streamer) {
  const rows = await ctx.db.select().from(schema.orders).where(and(eq(schema.orders.streamerId, s.id), eq(schema.orders.status, "queued")));
  return sortQueue(rows, s.queueOrder as "arrival" | "amount");
}

export function outputsStatus(ctx: Ctx, s: Streamer): OutputsStatus {
  const all = ctx.hub.outputsOf(s.id);
  const count = (k: string) => all.filter((c) => c.kind === k).length;
  const widgets: Record<string, number> = {};
  for (const c of all) widgets[c.kind] = (widgets[c.kind] ?? 0) + 1;
  const warnings = (["overlay", "combined", "player"] as const)
    .map((k) => warningFor(k, all.filter((c) => c.kind === k), s))
    .filter((w): w is string => !!w);
  const target = s.outputMode === "audio_only" ? count("player") : count("overlay") + count("combined");
  return { outputMode: s.outputMode as "overlay" | "audio_only", connected: target > 0, overlay: count("overlay") + count("combined"), player: count("player"), widgets, warnings };
}

/** Início da "live atual": primeira mensagem paga depois de uma pausa de 6 h sem mensagens (aproximação sem API das plataformas). */
async function liveStart(ctx: Ctx, streamerId: string) {
  const rows = await ctx.db.select({ paidAt: schema.orders.paidAt }).from(schema.orders)
    .where(and(eq(schema.orders.streamerId, streamerId), inArray(schema.orders.status, ["queued", "playing", "played"]), gte(schema.orders.paidAt, new Date(ctx.now().getTime() - 24 * 3600_000))))
    .orderBy(desc(schema.orders.paidAt));
  let start = ctx.now();
  for (const r of rows) {
    if (!r.paidAt) continue;
    if (start.getTime() - r.paidAt.getTime() > 6 * 3600_000) break;
    start = r.paidAt;
  }
  return start;
}

export async function snapshot(ctx: Ctx, streamerId: string): Promise<QueueSnapshot> {
  const s = await streamerById(ctx, streamerId);
  const queued = await queuedOrders(ctx, s);
  const playing = await ctx.db.query.orders.findFirst({ where: and(eq(schema.orders.streamerId, s.id), eq(schema.orders.status, "playing")) });
  const recent = await ctx.db.select().from(schema.orders).where(and(eq(schema.orders.streamerId, s.id), eq(schema.orders.status, "played"))).orderBy(desc(schema.orders.playedAt)).limit(20);
  const since = await liveStart(ctx, s.id);
  const [tot] = await ctx.db.select({ s: sql<string>`coalesce(sum(${schema.orders.amount}), 0)` }).from(schema.orders)
    .where(and(eq(schema.orders.streamerId, s.id), inArray(schema.orders.status, ["queued", "playing", "played"]), gte(schema.orders.paidAt, since)));
  const waits = recent.filter((o) => o.paidAt && o.startedAt).map((o) => (o.startedAt!.getTime() - o.paidAt!.getTime()) / 1000);
  return {
    nowPlaying: playing ? itemView(ctx, playing, null) : null,
    queued: queued.map((o, i) => itemView(ctx, o, i + 1)),
    recent: recent.map((o) => itemView(ctx, o, null)),
    stats: { queued: queued.length, avgWaitSeconds: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0, liveTotal: Number(tot!.s) },
    outputs: outputsStatus(ctx, s),
    volume: s.volume,
  };
}

export async function publishSnapshot(ctx: Ctx, streamerId: string) {
  ctx.hub.publishDashboard(streamerId, "queue.snapshot", await snapshot(ctx, streamerId));
}

export { appFromUserAgent };
