import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { Destination, UpdateWireConfig, WidgetId } from "@fedha/contracts";
import type { Ctx } from "../../../shared/context";
import { schema } from "../../../shared/database/client";
import { forbidden, notFound } from "../../../shared/errors/app-error";
import { audit } from "../../../shared/audit/audit";
import { requireAuth, streamerOf } from "../../../shared/http/auth";
import { streamerById } from "../../streamers/application/streamers.service";
import * as playback from "../application/playback.service";
import * as widgets from "../application/widgets.service";

/**
 * Rotas dos widgets W1–W6 no formato que o painel e o overlay usam (ids w1..w6, config com os nomes do overlay).
 * As rotas /v1/streamer/widgets/* continuam disponíveis com o formato completo (WidgetView).
 */
export async function widgetRoutes(app: FastifyInstance, ctx: Ctx) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const S = { preHandler: requireAuth(ctx, ["streamer"]) };
  const Id = z.object({ id: WidgetId });

  r.get("/v1/widgets", S, async (req) => widgets.widgetSummaries(ctx, await streamerOf(ctx, req)));

  r.put("/v1/widgets/:id", { ...S, schema: { params: Id, body: UpdateWireConfig } }, async (req) => {
    const s = await streamerOf(ctx, req);
    const kind = widgets.kindOfId(req.params.id);
    const row = (await widgets.ensureWidgets(ctx, s.id)).find((x) => x.kind === kind)!;
    const { config, enabled } = widgets.fromWire(widgets.widgetConfig(row), req.body);
    await widgets.updateWidget(ctx, s, kind, { config, enabled }, s.userId);
    return (await widgets.widgetSummaries(ctx, s)).find((w) => w.id === req.params.id);
  });

  /** Gera um token novo: o antigo deixa de funcionar e o overlay aberto recebe "revoked". */
  r.post("/v1/widgets/:id/token", { ...S, schema: { params: Id } }, async (req) => {
    const s = await streamerOf(ctx, req);
    const url = await widgets.regenerateWidget(ctx, s, widgets.kindOfId(req.params.id), s.userId);
    const w = (await widgets.widgetSummaries(ctx, s)).find((x) => x.id === req.params.id)!;
    return { id: w.id, token: w.token, url };
  });

  /** Alerta de teste para W1/W6 (ou Player no modo só áudio). Não cobra nada nem entra no histórico. */
  r.post("/v1/widgets/test", S, async (req) => {
    const s = await streamerOf(ctx, req);
    return playback.testAlert(ctx, s, { id: s.userId, type: "streamer" });
  });
  r.get("/v1/widgets/last-test", S, async (req) => playback.lastTest(ctx, (await streamerOf(ctx, req)).id));

  /** Onde o streamer faz live (decide o W5: QR desligado no TikTok e no Instagram). */
  r.get("/v1/streamer/destination", S, async (req) => {
    const s = await streamerOf(ctx, req);
    const d = Destination.safeParse(s.platform);
    return { destination: d.success ? d.data : null };
  });
  r.put("/v1/streamer/destination", { ...S, schema: { body: z.object({ destination: Destination }) } }, async (req) => {
    const s = await streamerOf(ctx, req);
    await ctx.db.update(schema.streamers).set({ platform: req.body.destination }).where(eq(schema.streamers.id, s.id));
    await audit(ctx, { actorId: s.userId, actorType: "streamer", action: "streamer.destination", streamerId: s.id, data: { destination: req.body.destination } });
    // Os overlays abertos recebem a configuração nova (destination muda o W5).
    const fresh = await streamerById(ctx, s.id);
    const rows = await widgets.ensureWidgets(ctx, s.id);
    for (const c of ctx.hub.outputsOf(s.id)) {
      const row = rows.find((x) => x.id === c.tokenId);
      if (!row) continue;
      const enabled = row.enabled && !(c.kind === "qr" && widgets.qrBlocked(fresh.platform));
      ctx.hub.sendTo(c, "config", widgets.toWire(widgets.widgetConfig(row), enabled, fresh));
    }
    return { destination: req.body.destination };
  });

  /**
   * Só desenvolvimento: confirma um pagamento do sandbox. Aceita o id do pagamento ou do pedido.
   * (O mesmo que POST /v1/sandbox/payments/:id/confirm, disponível fora de produção.)
   */
  app.post("/v1/dev/payments/:id/:action", async (req) => {
    if (ctx.env.NODE_ENV === "production") throw forbidden("Indisponível em produção.");
    const { id, action } = req.params as { id: string; action: string };
    if (action !== "confirm" && action !== "decline") throw notFound("Ação");
    let paymentId = id;
    const byOrder = await ctx.db.query.payments.findFirst({ where: and(eq(schema.payments.orderId, id), eq(schema.payments.status, "pending")), orderBy: desc(schema.payments.createdAt) });
    if (byOrder) paymentId = byOrder.id;
    const ok = await ctx.gateways.sandbox.settleByPaymentId(paymentId, action === "confirm" ? "confirmed" : "declined");
    if (!ok) throw notFound("Pagamento pendente no sandbox");
    return { ok: true, paymentId };
  });
}
