import { z } from "zod";
import { AlertAck, AlertEvent } from "../alert-event";
import { IsoDate, Kz } from "./common";
import { PublicGoal } from "./public";
import { OverlayState, OverlayWireConfig, WidgetConfig } from "./widgets";

/**
 * WebSocket /v1/realtime/overlay?token=<token>[&w=1..6][&layout=h|v]
 * Um token por widget (W1–W6) ou Player. Mensagens JSON { type, data }.
 */
export const RankingEntry = z.object({ donorName: z.string(), total: Kz, count: z.number().int() });
export const LatestEntry = z.object({ id: z.string(), donorName: z.string(), text: z.string().nullable(), kind: z.enum(["text", "audio"]), amount: Kz, at: IsoDate });

export const OverlayServerMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), data: z.object({ connectionId: z.string(), kind: z.string(), config: WidgetConfig, enabled: z.boolean(), volume: z.number().int() }) }),
  z.object({ type: z.literal("alert"), data: AlertEvent }),
  z.object({ type: z.literal("settings"), data: z.object({ config: WidgetConfig, enabled: z.boolean(), volume: z.number().int() }) }),
  z.object({ type: z.literal("goal"), data: PublicGoal.nullable() }),
  z.object({ type: z.literal("ranking"), data: z.array(RankingEntry) }),
  z.object({ type: z.literal("latest"), data: z.array(LatestEntry) }),
  z.object({ type: z.literal("pong"), data: z.object({ at: IsoDate }) }),
  /** Configuração no formato do overlay: ao ligar e sempre que o painel guarda. */
  z.object({ type: z.literal("config"), data: OverlayWireConfig }),
  /** Meta, ranking, últimas e tamanho da fila: ao ligar e sempre que mudam. */
  z.object({ type: z.literal("state"), data: OverlayState }),
  /** O link foi regenerado: o overlay deve parar e mostrar "link revogado". */
  z.object({ type: z.literal("revoked"), data: z.object({}).optional() }),
]);
export type OverlayServerMessage = z.infer<typeof OverlayServerMessage>;

export const OverlayClientMessage = z.discriminatedUnion("type", [
  /** O áudio começou a tocar. */
  z.object({ type: z.literal("started"), data: z.object({ id: z.string() }) }),
  /** O áudio acabou: a mensagem passa a "tocada". */
  z.object({ type: z.literal("ack"), data: AlertAck }),
  /** O navegador bloqueou o autoplay ou o áudio falhou ao carregar. */
  z.object({ type: z.literal("error"), data: z.object({ id: z.string(), reason: z.enum(["autoplay_blocked", "load_failed", "decode_failed"]) }) }),
  z.object({ type: z.literal("ping"), data: z.object({}).passthrough().optional() }),
  /** O overlay apresenta-se: widget (1–6), cenário (c1–c4) e app. */
  z.object({ type: z.literal("hello"), data: z.object({ widget: z.union([z.number(), z.string()]).optional(), scenario: z.string().max(8).optional(), userAgent: z.string().max(300).optional() }).passthrough().optional() }),
]);
export type OverlayClientMessage = z.infer<typeof OverlayClientMessage>;

/**
 * WebSocket /v1/realtime/dashboard?access_token=<jwt>[&streamerId=] (streamer ou assistente)
 * Canal queue:<streamerId>.
 */
export const QueueItemView = z.object({
  id: z.string(),
  donorName: z.string(),
  donorPhoneMasked: z.string().nullable(),
  kind: z.enum(["text", "audio"]),
  text: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  amount: Kz,
  tags: z.array(z.string()),
  priority: z.boolean(),
  status: z.enum(["queued", "playing", "played"]),
  position: z.number().int().nullable(),
  paidAt: IsoDate.nullable(),
  playedAt: IsoDate.nullable(),
  audioUrl: z.string().nullable(),
});
export type QueueItemView = z.infer<typeof QueueItemView>;

export const OutputsStatus = z.object({
  outputMode: z.enum(["overlay", "audio_only"]),
  connected: z.boolean(),
  overlay: z.number().int(),
  player: z.number().int(),
  widgets: z.record(z.number().int()),
  warnings: z.array(z.string()),
});
export type OutputsStatus = z.infer<typeof OutputsStatus>;

export const QueueSnapshot = z.object({
  nowPlaying: QueueItemView.nullable(),
  queued: z.array(QueueItemView),
  recent: z.array(QueueItemView),
  stats: z.object({ queued: z.number().int(), avgWaitSeconds: z.number().int(), liveTotal: Kz }),
  outputs: OutputsStatus,
  volume: z.number().int(),
});
export type QueueSnapshot = z.infer<typeof QueueSnapshot>;

export const DashboardServerMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("queue.snapshot"), data: QueueSnapshot }),
  z.object({ type: z.literal("outputs.status"), data: OutputsStatus }),
  z.object({ type: z.literal("notification"), data: z.object({ id: z.string(), event: z.string(), title: z.string(), body: z.string() }) }),
]);
export type DashboardServerMessage = z.infer<typeof DashboardServerMessage>;
