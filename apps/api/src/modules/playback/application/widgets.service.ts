import { and, eq, isNull } from "drizzle-orm";
import { WIDGET_CODE, WidgetConfig, type WidgetKind, type WidgetView } from "@fedha/contracts";
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
  const base = (kind === "player" ? ctx.env.PUBLIC_WEB_URL : ctx.env.PUBLIC_OVERLAY_URL ?? ctx.env.PUBLIC_WEB_URL).replace(/\/$/, "");
  return kind === "player" ? `${base}/player/${token}` : `${base}/o/${token}`;
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
  for (const c of ctx.hub.outputsOf(s.id, [kind])) ctx.hub.sendTo(c, "settings", { config, enabled, volume: s.volume });
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
