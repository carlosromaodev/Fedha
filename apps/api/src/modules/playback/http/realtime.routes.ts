import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { OverlayClientMessage, WIDGET_BY_ID, WidgetId } from "@fedha/contracts";
import type { Ctx } from "../../../shared/context";
import { schema } from "../../../shared/database/client";
import type { OutputKind } from "../../../shared/realtime/hub";
import { authenticate } from "../../auth/application/auth.service";
import { streamerById, streamerByUser } from "../../streamers/application/streamers.service";
import { assertAssistantOf } from "../../assistants/application/assistants.service";
import { snapshot, outputsStatus } from "../../queue/application/queue.service";
import * as playback from "../application/playback.service";
import { toWire, widgetConfig } from "../application/widgets.service";

export async function realtimeRoutes(app: FastifyInstance, ctx: Ctx) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /** Arranque do widget: tipo, configuração e URL do WebSocket. */
  r.get("/v1/overlay/:token", { schema: { params: z.object({ token: z.string() }) } }, async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    return playback.overlayBootstrap(ctx, req.params.token);
  });

  /**
   * WebSocket das saídas (W1–W6 e Player). O token identifica o widget.
   * Servidor → hello, alert, settings, goal, ranking, latest, pong. Cliente → started, ack, error, ping.
   */
  app.get("/v1/realtime/overlay", { websocket: true }, async (socket, req) => {
    const q = req.query as { token?: string; layout?: string; w?: string };
    const row = q.token ? await ctx.db.query.widgetTokens.findFirst({ where: eq(schema.widgetTokens.token, q.token) }) : null;
    if (!row || row.revokedAt) { socket.close(4001, "token inválido"); return; }
    const s = await streamerById(ctx, row.streamerId);
    if (s.status !== "active") { socket.close(4003, "conta suspensa"); return; }
    await ctx.db.update(schema.widgetTokens).set({ lastSeenAt: ctx.now() }).where(eq(schema.widgetTokens.id, row.id));

    // ?w=1..6 escolhe o widget (o mesmo link do streamer pode abrir W1 ou W6, por exemplo).
    const wId = WidgetId.safeParse(q.w ? `w${q.w}` : "");
    const kind = (row.kind !== "player" && wId.success ? WIDGET_BY_ID[wId.data] : row.kind) as OutputKind;
    const conn = ctx.hub.addOutput({
      streamerId: s.id, kind, tokenId: row.id, layout: q.layout ?? null,
      userAgent: (req.headers["user-agent"] as string) ?? null, ip: req.ip ?? null, socket,
    });
    ctx.hub.sendTo(conn, "hello", { connectionId: conn.id, kind, config: widgetConfig(row), enabled: row.enabled, volume: s.volume });
    const enabled = row.enabled && !(kind === "qr" && (s.platform === "tiktok" || s.platform === "instagram"));
    ctx.hub.sendTo(conn, "config", toWire(widgetConfig(row), enabled, s));
    void playback.pushWidgetData(ctx, s.id, conn);
    void playback.engine(ctx).pump(s.id);

    socket.on("message", async (raw: Buffer) => {
      let msg;
      try { msg = OverlayClientMessage.parse(JSON.parse(raw.toString())); } catch { return; }
      conn.lastPingAt = new Date();
      if (msg.type === "ping") ctx.hub.sendTo(conn, "pong", { at: ctx.now().toISOString() });
      else if (msg.type === "ack") await playback.engine(ctx).ack(conn, msg.data.id);
      else if (msg.type === "started") await playback.engine(ctx).started(conn, msg.data.id);
      else if (msg.type === "error") await playback.engine(ctx).onError(conn, msg.data.id, msg.data.reason);
      else if (msg.type === "hello") {
        conn.scenario = msg.data?.scenario ?? null;
        if (msg.data?.userAgent && !conn.userAgent) conn.userAgent = msg.data.userAgent;
        ctx.hub.onOutputsChanged(s.id);
      }
    });
    socket.on("close", async () => {
      ctx.hub.removeOutput(conn.id);
      await ctx.db.update(schema.widgetTokens).set({ lastSeenAt: ctx.now() }).where(eq(schema.widgetTokens.id, row.id)).catch(() => undefined);
      await playback.engine(ctx).onDisconnect(conn);
    });
  });

  /** WebSocket do painel (S1/S2) e do assistente: fila em tempo real e estado das saídas. */
  app.get("/v1/realtime/dashboard", { websocket: true }, async (socket, req) => {
    const q = req.query as { access_token?: string; token?: string; streamerId?: string };
    let streamerId: string;
    let userId: string;
    try {
      const { user } = await authenticate(ctx, q.access_token ?? q.token ?? "");
      userId = user.id;
      if (user.role === "streamer") streamerId = (await streamerByUser(ctx, user.id))!.id;
      else if (user.role === "assistant" && q.streamerId) streamerId = (await assertAssistantOf(ctx, user.id, q.streamerId)).id;
      else throw new Error("sem streamer");
    } catch {
      socket.close(4001, "não autorizado");
      return;
    }
    const id = ctx.hub.addDashboard(streamerId, userId, socket);
    socket.send(JSON.stringify({ type: "queue.snapshot", data: await snapshot(ctx, streamerId) }));
    socket.on("message", (raw: Buffer) => {
      if (raw.toString().includes("ping")) socket.send(JSON.stringify({ type: "pong", data: { at: ctx.now().toISOString() } }));
    });
    socket.on("close", () => ctx.hub.removeDashboard(id));
  });

  // Quando uma saída liga ou desliga, o painel recebe o novo estado (inclui o aviso "aberto em 2 sítios").
  ctx.hub.onOutputsChanged = (streamerId) => {
    void streamerById(ctx, streamerId)
      .then((s) => ctx.hub.publishDashboard(streamerId, "outputs.status", outputsStatus(ctx, s)))
      .catch(() => undefined);
  };
}
