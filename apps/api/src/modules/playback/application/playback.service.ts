import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { AlertEvent, OverlayBootstrap, WidgetKind } from "@fedha/contracts";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { conflict, notFound } from "../../../shared/errors/app-error";
import { uuid } from "../../../shared/security/ids";
import { audit } from "../../../shared/audit/audit";
import { startOfLuandaDay } from "../../../shared/money/money";
import type { OutputConnection } from "../../../shared/realtime/hub";
import { failOrder } from "../../payments/application/payments.service";
import { streamerById, type Streamer } from "../../streamers/application/streamers.service";
import { activeGoal } from "../../goals/application/goals.service";
import { publishSnapshot } from "../../queue/application/queue.service";
import type { PlaybackEngine } from "./engine";
import { tokenRow, widgetConfig, widgetUrl } from "./widgets.service";

const engines = new WeakMap<Ctx, PlaybackEngine>();
export const setEngine = (ctx: Ctx, e: PlaybackEngine) => engines.set(ctx, e);
export const engine = (ctx: Ctx) => engines.get(ctx)!;

/**
 * Depois do pagamento: gera o TTS no servidor (ou usa o áudio gravado) e põe a mensagem pronta a tocar.
 * Falha técnica → pedido falhado e reembolso (F4).
 */
export async function prepareAudio(ctx: Ctx, orderId: string) {
  const o = await ctx.db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!o || o.audioKey || !["queued"].includes(o.status)) return;
  try {
    if (o.kind === "text") {
      const voice = o.voiceId ? await ctx.db.query.voices.findFirst({ where: eq(schema.voices.id, o.voiceId) }) : null;
      const spoken = o.anonymous ? `Mensagem anónima: ${o.text}` : `${o.donorName} diz: ${o.text}`;
      const r = await ctx.tts.synthesize(spoken, { provider: voice?.provider ?? "default", providerVoiceId: voice?.providerVoiceId ?? "" });
      const key = `audio/${o.streamerId}/${o.id}.${r.ext}`;
      await ctx.storage.put(key, r.data, r.mime);
      await ctx.db.update(schema.orders).set({ audioKey: key, durationMs: r.durationMs }).where(eq(schema.orders.id, o.id));
    } else {
      const up = o.audioUploadId ? await ctx.db.query.audioUploads.findFirst({ where: eq(schema.audioUploads.id, o.audioUploadId) }) : null;
      const file = up && !up.deletedAt ? await ctx.storage.get(up.storageKey) : null;
      if (!up || !file || file.data.length < 100) throw new Error("áudio gravado em falta ou corrompido");
      await ctx.db.update(schema.orders).set({ audioKey: up.storageKey, durationMs: up.durationMs }).where(eq(schema.orders.id, o.id));
    }
  } catch (err) {
    ctx.log.error({ err, orderId }, "falha a preparar o áudio");
    await failOrder(ctx, orderId, o.kind === "text" ? "Erro ao gerar a voz da mensagem." : "O áudio gravado está corrompido.");
    return;
  }
  await publishSnapshot(ctx, o.streamerId);
  void engine(ctx).pump(o.streamerId);
}

// ------------------------------------------------------------- ações do streamer (S2, S6)
export async function testAlert(ctx: Ctx, s: Streamer, actor: { id: string; type: "streamer" | "assistant" }) {
  const r = await ctx.tts.synthesize("Isto é um alerta de teste do Fedha Live. Se estás a ouvir, está tudo ligado.", { provider: "default", providerVoiceId: "" });
  const key = `audio/${s.id}/teste-${uuid()}.${r.ext}`;
  await ctx.storage.put(key, r.data, r.mime);
  const alert: AlertEvent = {
    id: `TESTE-${uuid().slice(0, 8)}`, streamerId: s.id, donorName: "Fedha Live", amountKz: 1000, kind: "text",
    text: "Alerta de teste: se vês isto e ouves a voz, o overlay está pronto.", audioUrl: ctx.storage.publicUrl(key),
    durationMs: r.durationMs, showAmount: true, createdAt: ctx.now().toISOString(), isTest: true,
  };
  const targets = ctx.hub.outputsOf(s.id, engine(ctx).targetKinds(s.outputMode));
  // Sem saída ligada, o teste não fica guardado (não faz sentido tocar mais tarde).
  if (targets.length) engine(ctx).enqueueExtra(s.id, alert);
  await audit(ctx, { actorId: actor.id, actorType: actor.type, action: "playback.test_alert", streamerId: s.id });
  return { sent: targets.length > 0, outputs: targets.length };
}

export async function replay(ctx: Ctx, s: Streamer, orderId: string, actor: { id: string; type: "streamer" | "assistant" }) {
  const o = await ctx.db.query.orders.findFirst({ where: and(eq(schema.orders.id, orderId), eq(schema.orders.streamerId, s.id)) });
  if (!o) throw notFound("Mensagem");
  if (o.status !== "played" || !o.audioKey) throw conflict("not_replayable", "Só podes repetir mensagens já tocadas.");
  const alert: AlertEvent = {
    id: `${o.id}-R${uuid().slice(0, 4)}`, streamerId: s.id, donorName: o.donorName, amountKz: o.amount, kind: o.kind as "text" | "audio",
    text: o.kind === "text" ? o.text : null, audioUrl: ctx.storage.publicUrl(o.audioKey), durationMs: o.durationMs ?? 5000, showAmount: true,
    createdAt: (o.paidAt ?? o.createdAt).toISOString(), isReplay: true,
  };
  engine(ctx).enqueueExtra(s.id, alert);
  await ctx.db.update(schema.orders).set({ playCount: o.playCount + 1 }).where(eq(schema.orders.id, o.id));
  await audit(ctx, { actorId: actor.id, actorType: actor.type, action: "playback.replay", targetType: "order", targetId: o.id, streamerId: s.id });
  return { ok: true };
}

export async function setVolume(ctx: Ctx, s: Streamer, volume: number, actor: { id: string; type: "streamer" | "assistant" }) {
  await ctx.db.update(schema.streamers).set({ volume }).where(eq(schema.streamers.id, s.id));
  for (const c of ctx.hub.outputsOf(s.id)) {
    const row = c.tokenId ? await ctx.db.query.widgetTokens.findFirst({ where: eq(schema.widgetTokens.id, c.tokenId) }) : null;
    ctx.hub.sendTo(c, "settings", { config: row ? widgetConfig(row) : {}, enabled: row?.enabled ?? true, volume });
  }
  await audit(ctx, { actorId: actor.id, actorType: actor.type, action: "playback.volume", streamerId: s.id, data: { volume } });
  await publishSnapshot(ctx, s.id);
}

// ------------------------------------------------------------- widgets W2–W4
export async function ranking(ctx: Ctx, streamerId: string, period: "live" | "day" | "month", size: number) {
  const now = ctx.now();
  const since = period === "day" ? startOfLuandaDay(now) : period === "month" ? new Date(now.getTime() - 30 * 86400_000) : new Date(now.getTime() - 12 * 3600_000);
  const rows = await ctx.db.select({ donorName: schema.orders.donorName, total: sql<string>`sum(${schema.orders.amount})`, count: sql<string>`count(*)` })
    .from(schema.orders)
    .where(and(eq(schema.orders.streamerId, streamerId), inArray(schema.orders.status, ["queued", "playing", "played"]), eq(schema.orders.anonymous, false), gte(schema.orders.paidAt, since)))
    .groupBy(schema.orders.donorName).orderBy(desc(sql`sum(${schema.orders.amount})`)).limit(size);
  return rows.map((r) => ({ donorName: r.donorName, total: Number(r.total), count: Number(r.count) }));
}

export async function latest(ctx: Ctx, streamerId: string, count: number) {
  const rows = await ctx.db.select().from(schema.orders).where(and(eq(schema.orders.streamerId, streamerId), eq(schema.orders.status, "played")))
    .orderBy(desc(schema.orders.playedAt)).limit(count);
  return rows.map((o) => ({ id: o.id, donorName: o.donorName, text: o.kind === "text" ? o.text : null, kind: o.kind as "text" | "audio", amount: o.amount, at: (o.playedAt ?? o.createdAt).toISOString() }));
}

/** Envia os dados atuais aos widgets de meta, ranking, últimas e combinado. */
export async function pushWidgetData(ctx: Ctx, streamerId: string, only?: OutputConnection) {
  const conns = only ? [only] : ctx.hub.outputsOf(streamerId, ["goal", "ranking", "latest", "combined"]);
  if (conns.length === 0) return;
  const goal = await activeGoal(ctx, streamerId);
  for (const c of conns) {
    const row = c.tokenId ? await ctx.db.query.widgetTokens.findFirst({ where: eq(schema.widgetTokens.id, c.tokenId) }) : null;
    const cfg = row ? widgetConfig(row) : null;
    if (c.kind === "goal" || c.kind === "combined") ctx.hub.sendTo(c, "goal", goal);
    if (c.kind === "ranking") ctx.hub.sendTo(c, "ranking", await ranking(ctx, streamerId, cfg?.rankingPeriod ?? "live", cfg?.rankingSize ?? 5));
    if (c.kind === "latest") ctx.hub.sendTo(c, "latest", await latest(ctx, streamerId, cfg?.latestCount ?? 5));
  }
}

// ------------------------------------------------------------- arranque do widget
export async function overlayBootstrap(ctx: Ctx, token: string): Promise<OverlayBootstrap> {
  const row = await tokenRow(ctx, token);
  const s = await streamerById(ctx, row.streamerId);
  const wsBase = ctx.env.PUBLIC_API_URL.replace(/^http/, "ws").replace(/\/$/, "");
  return {
    kind: row.kind as WidgetKind,
    streamerId: s.id,
    handle: s.handle,
    displayName: s.displayName,
    enabled: row.enabled && !(row.kind === "qr" && (s.platform === "tiktok" || s.platform === "instagram")),
    config: widgetConfig(row),
    donateUrl: `${ctx.env.PUBLIC_WEB_URL.replace(/\/$/, "")}/${s.handle}`,
    wsUrl: `${wsBase}/v1/realtime/overlay?token=${encodeURIComponent(token)}`,
  };
}

export { widgetUrl };
