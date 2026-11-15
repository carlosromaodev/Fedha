import { z } from "zod";
import { OutputMode } from "../alert-event";
import { IsoDate, Kz, Platform } from "./common";

/** W1 Alerta · W2 Meta · W3 Últimas mensagens · W4 Top doadores · W5 QR · W6 Combinado · S3 Player (só áudio). RF-WID-08 */
export const WidgetKind = z.enum(["overlay", "goal", "ranking", "latest", "qr", "combined", "player"]);
export type WidgetKind = z.infer<typeof WidgetKind>;
export const WIDGET_CODE: Record<WidgetKind, string> = {
  overlay: "W1", goal: "W2", latest: "W3", ranking: "W4", qr: "W5", combined: "W6", player: "S3",
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
    { tier: "destaque", minAmount: 1000, sound: null, minDisplayMs: 8000 },
    { tier: "super", minAmount: 5000, sound: null, minDisplayMs: 12000 },
  ]),
  /** W4: período do top de doadores. */
  rankingPeriod: z.enum(["live", "day", "month"]).default("live"),
  rankingSize: z.number().int().min(3).max(10).default(5),
  /** W3: quantas mensagens mostrar. */
  latestCount: z.number().int().min(1).max(10).default(5),
  /** W5: texto de chamada. */
  qrCallToAction: z.string().max(60).default("Manda a tua mensagem!"),
  /** Cor de destaque do overlay (#RRGGBB). */
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#C9F25C"),
  /** Tamanho: p pequeno, m médio, g grande. */
  size: z.enum(["p", "m", "g"]).default("m"),
  /** Texto acompanha a voz palavra a palavra. */
  karaoke: z.boolean().default(true),
  /** Regras de tempo (AN0): entrada 400–700 ms, saída 300–500 ms, intervalo 0–5 s. */
  enterMs: z.number().int().min(400).max(700).default(500),
  exitMs: z.number().int().min(300).max(500).default(400),
  gapMs: z.number().int().min(0).max(5000).default(1500),
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

/** Identificadores curtos usados pelo painel e pelo overlay (?w=1..6). */
export const WidgetId = z.enum(["w1", "w2", "w3", "w4", "w5", "w6"]);
export type WidgetId = z.infer<typeof WidgetId>;
export const WIDGET_BY_ID: Record<WidgetId, WidgetKind> = { w1: "overlay", w2: "goal", w3: "latest", w4: "ranking", w5: "qr", w6: "combined" };
export const ID_BY_WIDGET: Partial<Record<WidgetKind, WidgetId>> = { overlay: "w1", goal: "w2", latest: "w3", ranking: "w4", qr: "w5", combined: "w6" };

export const Destination = z.enum(["tiktok", "instagram", "youtube", "twitch", "kick", "facebook"]);
export type Destination = z.infer<typeof Destination>;

/**
 * Configuração tal como o overlay a usa (mensagem WS "config" e GET/PUT /v1/widgets).
 * Os nomes seguem apps/overlay/src/config.ts. volume vai de 0 a 1.
 */
export const OverlayWireConfig = z.object({
  theme: WidgetTheme,
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  size: z.enum(["p", "m", "g"]),
  showName: z.boolean(),
  showValue: z.boolean(),
  karaoke: z.boolean(),
  reduceMotion: z.boolean(),
  highlightFrom: Kz,
  superFrom: Kz,
  enterMs: z.number().int().min(400).max(700),
  exitMs: z.number().int().min(300).max(500),
  gapMs: z.number().int().min(0).max(5000),
  volume: z.number().min(0).max(1),
  destination: Destination,
  qrCall: z.string().max(60),
  handle: z.string(),
  enabled: z.boolean(),
});
export type OverlayWireConfig = z.infer<typeof OverlayWireConfig>;
/** O que o painel pode mudar (destination e handle vêm do perfil). */
export const UpdateWireConfig = OverlayWireConfig.omit({ destination: true, handle: true }).partial();

/** Estado partilhado pelos widgets W2–W6 (mensagem WS "state"). */
export const OverlayState = z.object({
  goal: z.object({ title: z.string(), current: Kz, target: Kz }).nullable(),
  ranking: z.array(z.object({ name: z.string(), kz: Kz })),
  latest: z.array(z.object({ name: z.string(), kz: Kz, text: z.string() })),
  queueSize: z.number().int(),
});
export type OverlayState = z.infer<typeof OverlayState>;

export const WidgetConn = z.enum(["aberto", "fechado", "a_religar"]);
export const WidgetSummary = z.object({
  id: WidgetId,
  token: z.string(),
  url: z.string(),
  conn: WidgetConn,
  /** Onde está aberto (cenário C1–C4 e app pelo user agent). */
  where: z.string().nullable(),
  openCount: z.number().int(),
  warning: z.string().nullable(),
  blocked: z.boolean(),
  blockedReason: z.string().nullable(),
  config: OverlayWireConfig,
});
export type WidgetSummary = z.infer<typeof WidgetSummary>;

export const LastTest = z.object({ sentAt: IsoDate.nullable(), pageOpen: z.boolean(), played: z.boolean() });
export type LastTest = z.infer<typeof LastTest>;
