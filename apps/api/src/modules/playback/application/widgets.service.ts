import { and, eq, isNull } from "drizzle-orm";
import {
  ID_BY_WIDGET, WIDGET_BY_ID, WIDGET_CODE, WidgetConfig, Destination,
  type OverlayWireConfig, type UpdateWireConfig, type WidgetId, type WidgetKind, type WidgetSummary, type WidgetView,
} from "@fedha/contracts";
import type { z } from "zod";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { notFound } from "../../../shared/errors/app-error";
import { secretToken, uuid } from "../../../shared/security/ids";
import { audit } from "../../../shared/audit/audit";
import type { OutputConnection } from "../../../shared/realtime/hub";
import type { Streamer } from "../../streamers/application/streamers.service";

export const WIDGET_KINDS: WidgetKind[] = ["overlay", "goal", "ranking", "latest", "qr", "combined", "player"];
type TokenRow = typeof schema.widgetTokens.$inferSelect;

export function widgetUrl(ctx: Ctx, kind: WidgetKind, token: string) {
  const base = (kind === "player" ? ctx.env.PUBLIC_WEB_URL : ctx.env.PUBLIC_OVERLAY_URL).replace(/\/$/, "");
  const id = ID_BY_WIDGET[kind];
  return kind === "player" ? `${base}/player/${token}` : `${base}/o/${token}${id ? `?w=${id.slice(1)}` : ""}`;
}

/** Cria (uma vez) um token ativo por widget. */
export async function ensureWidgets(ctx: Ctx, streamerId: string): Promise<TokenRow[]> {
  const rows = await ctx.db.select().from(schema.widgetTokens).where(and(eq(schema.widgetTokens.streamerId, streamerId), isNull(schema.widgetTokens.revokedAt)));
  const missing = WIDGET_KINDS.filter((k) => !rows.some((r) => r.kind === k));
  if (missing.length) {
    const fresh = missing.map((kind) => ({
      id: uuid(), streamerId, kind, token: secretToken(), enabled: kind !== "qr", config: WidgetConfig.parse({}) as Record<string, unknown>, createdAt: ctx.now(), revokedAt: null, lastSeenAt: null,
    }));
    await ctx.db.insert(schema.widgetTokens).values(fresh);
    rows.push(...fresh);
  }
  return rows;
}

export async function tokenRow(ctx: Ctx, token: string) {
  const row = await ctx.db.query.widgetTokens.findFirst({ where: and(eq(schema.widgetTokens.token, token), isNull(schema.widgetTokens.revokedAt)) });
  if (!row) throw notFound("Widget");
  return row;
}

export const widgetConfig = (row: TokenRow) => WidgetConfig.parse(row.config ?? {});

export function qrBlocked(platform: string | null) {
  return platform === "tiktok" || platform === "instagram";
}

export function appFromUserAgent(ua: string | null) {
  const u = (ua ?? "").toLowerCase();
  if (u.includes("streamlabs")) return "streamlabs";
  if (u.includes("obs/") || u.includes("obs-browser")) return "obs";
  if (u.includes("tiktok")) return "tiktok_live_studio";
  if (u.includes("prism")) return "prism";
  if (u.includes("camerafi")) return "camerafi";
  return "browser";
}

const LABEL: Partial<Record<WidgetKind, string>> = { overlay: "W1", combined: "W6", player: "O Player" };

export function warningFor(kind: WidgetKind, conns: OutputConnection[], streamer: Streamer): string | null {
  if ((kind === "overlay" || kind === "combined" || kind === "player") && conns.length > 1)
    return `${LABEL[kind] ?? WIDGET_CODE[kind]} está aberto em ${conns.length} sítios. Cada mensagem só toca num deles; fecha os que não usas.`;
  if (kind === "player" && conns.length > 0 && streamer.outputMode === "overlay")
    return "O Player está aberto, mas o modo de saída é overlay: as mensagens tocam no overlay.";
  if ((kind === "overlay" || kind === "combined") && conns.length > 0 && streamer.outputMode === "audio_only")
    return "O overlay está aberto, mas o modo de saída é só áudio: as mensagens tocam no Player.";
  return null;
}

export async function widgetsView(ctx: Ctx, s: Streamer): Promise<WidgetView[]> {
  const rows = await ensureWidgets(ctx, s.id);
  return WIDGET_KINDS.map((kind) => {
    const row = rows.find((r) => r.kind === kind)!;
    const conns = ctx.hub.outputsOf(s.id, [kind]);
    const blocked = kind === "qr" && qrBlocked(s.platform);
    return {
      kind,
      code: WIDGET_CODE[kind],
      url: widgetUrl(ctx, kind, row.token),
      enabled: row.enabled && !blocked,
      blocked,
      blockedReason: blocked ? "O TikTok e o Instagram não permitem QR codes nem links no ecrã. Põe o teu link só na bio." : null,
      config: widgetConfig(row),
      open: conns.length > 0,
      connections: conns.map((c) => ({ id: c.id, kind: c.kind, layout: c.layout, userAgent: c.userAgent, app: appFromUserAgent(c.userAgent), connectedAt: c.connectedAt.toISOString() })),
      warning: warningFor(kind, conns, s),
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    };
  });
}

export async function updateWidget(ctx: Ctx, s: Streamer, kind: WidgetKind, input: { enabled?: boolean; config?: Partial<WidgetConfig> }, actorId: string) {
  const rows = await ensureWidgets(ctx, s.id);
  const row = rows.find((r) => r.kind === kind)!;
  const config = WidgetConfig.parse({ ...widgetConfig(row), ...(input.config ?? {}) });
  const enabled = input.enabled ?? row.enabled;
  await ctx.db.update(schema.widgetTokens).set({ config, enabled }).where(eq(schema.widgetTokens.id, row.id));
  await audit(ctx, { actorId, actorType: "streamer", action: "widget.updated", targetType: "widget", targetId: kind, streamerId: s.id });
  const wire = toWire(config, enabled, s);
  for (const c of ctx.hub.outputsOf(s.id)) {
    if (c.tokenId !== row.id) continue;
    ctx.hub.sendTo(c, "settings", { config, enabled, volume: s.volume });
    ctx.hub.sendTo(c, "config", wire);
  }
  return config;
}

/** Revoga o link antigo (fecha as ligações) e cria um novo. */
export async function regenerateWidget(ctx: Ctx, s: Streamer, kind: WidgetKind, actorId: string) {
  const rows = await ensureWidgets(ctx, s.id);
  const old = rows.find((r) => r.kind === kind)!;
  await ctx.db.update(schema.widgetTokens).set({ revokedAt: ctx.now() }).where(eq(schema.widgetTokens.id, old.id));
  ctx.hub.dropToken(old.id);
  const token = secretToken();
  await ctx.db.insert(schema.widgetTokens).values({ id: uuid(), streamerId: s.id, kind, token, enabled: old.enabled, config: old.config, createdAt: ctx.now() });
  await audit(ctx, { actorId, actorType: "streamer", action: "widget.regenerated", targetType: "widget", targetId: kind, streamerId: s.id });
  return widgetUrl(ctx, kind, token);
}

// ------------------------------------------------------------- formato do overlay (apps/overlay)
const tierMin = (cfg: WidgetConfig, tier: "destaque" | "super", dflt: number) => cfg.tiers.find((t) => t.tier === tier)?.minAmount ?? dflt;

/** WidgetConfig → configuração com os nomes que o overlay usa. */
export function toWire(cfg: WidgetConfig, enabled: boolean, s: Pick<Streamer, "handle" | "platform">): OverlayWireConfig {
  const dest = Destination.safeParse(s.platform);
  return {
    theme: cfg.theme, accent: cfg.accent, size: cfg.size, showName: cfg.showName, showValue: cfg.showAmount,
    karaoke: cfg.karaoke, reduceMotion: cfg.reduceMotion,
    highlightFrom: tierMin(cfg, "destaque", 1000), superFrom: tierMin(cfg, "super", 5000),
    enterMs: cfg.enterMs, exitMs: cfg.exitMs, gapMs: cfg.gapMs, volume: cfg.volume / 100,
    destination: dest.success ? dest.data : "tiktok", qrCall: cfg.qrCallToAction, handle: s.handle, enabled,
  };
}

/** Configuração no formato do overlay → alterações ao WidgetConfig. */
export function fromWire(cur: WidgetConfig, w: z.infer<typeof UpdateWireConfig>): { config: WidgetConfig; enabled?: boolean } {
  const next: WidgetConfig = { ...cur, tiers: cur.tiers.map((t) => ({ ...t })) };
  if (w.theme !== undefined) next.theme = w.theme;
  if (w.accent !== undefined) next.accent = w.accent;
  if (w.size !== undefined) next.size = w.size;
  if (w.showName !== undefined) next.showName = w.showName;
  if (w.showValue !== undefined) next.showAmount = w.showValue;
  if (w.karaoke !== undefined) next.karaoke = w.karaoke;
  if (w.reduceMotion !== undefined) next.reduceMotion = w.reduceMotion;
  if (w.enterMs !== undefined) next.enterMs = w.enterMs;
  if (w.exitMs !== undefined) next.exitMs = w.exitMs;
  if (w.gapMs !== undefined) next.gapMs = w.gapMs;
  if (w.volume !== undefined) next.volume = Math.round(w.volume * 100);
  if (w.qrCall !== undefined) next.qrCallToAction = w.qrCall;
  const setTier = (tier: "destaque" | "super", v: number) => {
    const t = next.tiers.find((x) => x.tier === tier);
    if (t) t.minAmount = v; else next.tiers.push({ tier, minAmount: v, sound: null, minDisplayMs: tier === "super" ? 12000 : 8000 });
  };
  if (w.highlightFrom !== undefined) setTier("destaque", w.highlightFrom);
  if (w.superFrom !== undefined) setTier("super", w.superFrom);
  return { config: WidgetConfig.parse(next), enabled: w.enabled };
}

export const kindOfId = (id: WidgetId) => WIDGET_BY_ID[id];

/** Lista W1–W6 para o painel: token, estado da ligação, onde está aberto e configuração. */
export async function widgetSummaries(ctx: Ctx, s: Streamer): Promise<WidgetSummary[]> {
  const views = await widgetsView(ctx, s);
  const rows = await ensureWidgets(ctx, s.id);
  const out: WidgetSummary[] = [];
  for (const v of views) {
    const id = ID_BY_WIDGET[v.kind];
    if (!id) continue;
    const row = rows.find((r) => r.kind === v.kind)!;
    const conns = ctx.hub.outputsOf(s.id, [v.kind]);
    const where = conns.length
      ? [...new Set(conns.map((c) => [c.scenario?.toUpperCase(), appFromUserAgent(c.userAgent)].filter(Boolean).join(" · ")))].join(", ")
      : null;
    out.push({
      id, token: row.token, url: v.url,
      conn: conns.length ? "aberto" : ctx.hub.closedRecently(s.id, v.kind) ? "a_religar" : "fechado",
      where, openCount: conns.length, warning: v.warning, blocked: v.blocked, blockedReason: v.blockedReason,
      config: toWire(v.config, v.enabled, s),
    });
  }
  return out;
}
