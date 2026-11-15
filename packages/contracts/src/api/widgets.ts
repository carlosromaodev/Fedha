import { z } from "zod";
import { OutputMode } from "../alert-event";
import { IsoDate, Kz, Platform } from "./common";

/** W1 Alerta · W2 Meta · W3 Ranking · W4 Últimas · W5 QR · W6 Combinado · S3 Player (só áudio) */
export const WidgetKind = z.enum(["overlay", "goal", "ranking", "latest", "qr", "combined", "player"]);
export type WidgetKind = z.infer<typeof WidgetKind>;
export const WIDGET_CODE: Record<WidgetKind, string> = {
  overlay: "W1", goal: "W2", ranking: "W3", latest: "W4", qr: "W5", combined: "W6", player: "S3",
};

export const WidgetTheme = z.enum(["claro", "noite", "sinal"]);
export const WidgetLayout = z.enum(["h", "v"]);

/** Nível do alerta por valor: a partir de minAmount usa este nível. */
export const TierRule = z.object({
  tier: z.enum(["normal", "destaque", "super"]),
  minAmount: Kz,
  sound: z.string().nullable(),
  /** Tempo mínimo no ecrã (o alerta fica sempre enquanto o áudio toca). */
  minDisplayMs: z.number().int().min(1000).max(60000),
});

/** Configuração de cada widget (S6). Campos que não se aplicam a um widget são ignorados. */
export const WidgetConfig = z.object({
  theme: WidgetTheme.default("noite"),
  layout: WidgetLayout.default("h"),
  position: z.enum(["top", "center", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"]).default("top"),
  reduceMotion: z.boolean().default(false),
  showAmount: z.boolean().default(true),
  showName: z.boolean().default(true),
  /** Valor mínimo para aparecer no ecrã (abaixo disso só toca o áudio). */
  minAmountOnScreen: Kz.default(0),
  /** Volume 0–100 do áudio deste widget. */
  volume: z.number().int().min(0).max(100).default(80),
  entrySound: z.string().nullable().default(null),
  tiers: z.array(TierRule).default([
    { tier: "normal", minAmount: 0, sound: null, minDisplayMs: 5000 },
    { tier: "destaque", minAmount: 2000, sound: null, minDisplayMs: 8000 },
    { tier: "super", minAmount: 10000, sound: null, minDisplayMs: 12000 },
  ]),
  /** W3: período do ranking. */
  rankingPeriod: z.enum(["live", "day", "month"]).default("live"),
  rankingSize: z.number().int().min(3).max(10).default(5),
  /** W4: quantas mensagens mostrar. */
  latestCount: z.number().int().min(1).max(10).default(5),
  /** W5: texto de chamada. */
  qrCallToAction: z.string().max(60).default("Manda a tua mensagem"),
});
export type WidgetConfig = z.infer<typeof WidgetConfig>;
export const UpdateWidgetBody = z.object({ enabled: z.boolean().optional(), config: WidgetConfig.partial().optional() });

export const OutputConnectionView = z.object({
  id: z.string(),
  kind: WidgetKind,
  layout: z.string().nullable(),
  userAgent: z.string().nullable(),
  /** "obs" | "streamlabs" | "tiktok_live_studio" | "prism" | "browser" (pelo user agent) */
  app: z.string(),
  connectedAt: IsoDate,
});

export const WidgetView = z.object({
  kind: WidgetKind,
  code: z.string(),
  url: z.string(),
  enabled: z.boolean(),
  /** Desligado pela plataforma (ex.: W5 em TikTok e Instagram). */
  blocked: z.boolean(),
  blockedReason: z.string().nullable(),
  config: WidgetConfig,
  /** Aberto = tem pelo menos uma ligação ativa agora. */
  open: z.boolean(),
  connections: z.array(OutputConnectionView),
  /** Ex.: "O W1 está aberto em 2 sítios." */
  warning: z.string().nullable(),
  lastSeenAt: IsoDate.nullable(),
});
export type WidgetView = z.infer<typeof WidgetView>;

export const WidgetsResponse = z.object({
  outputMode: OutputMode,
  platform: Platform.nullable(),
  widgets: z.array(WidgetView),
});

/** GET /v1/overlay/:token — o que a página do widget precisa para arrancar. */
export const OverlayBootstrap = z.object({
  kind: WidgetKind,
  streamerId: z.string(),
  handle: z.string(),
  displayName: z.string(),
  enabled: z.boolean(),
  config: WidgetConfig,
  donateUrl: z.string(),
  wsUrl: z.string(),
});
export type OverlayBootstrap = z.infer<typeof OverlayBootstrap>;
