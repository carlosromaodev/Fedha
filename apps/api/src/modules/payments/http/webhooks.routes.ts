import type { FastifyInstance } from "fastify";
import type { Ctx } from "../../../shared/context";
import { forbidden, notFound } from "../../../shared/errors/app-error";
import { handleWebhook } from "../application/payments.service";

/** Webhooks dos gateways (corpo em bruto para validar a assinatura) e simulador do sandbox. */
export async function webhookRoutes(app: FastifyInstance, ctx: Ctx) {
  await app.register(async (scoped) => {
    scoped.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => done(null, body));
    scoped.post("/v1/webhooks/payments/:provider", async (req, reply) => {
      const { provider } = req.params as { provider: string };
      const res = await handleWebhook(ctx, provider, req.headers, String(req.body ?? ""));
      return reply.send({ ok: true, ...res });
    });
  });

  // Só desenvolvimento: simula a aprovação ou recusa no banco.
  app.post("/v1/sandbox/payments/:id/:action", async (req) => {
    if (ctx.env.NODE_ENV === "production") throw forbidden("Indisponível em produção.");
    const { id, action } = req.params as { id: string; action: string };
    if (action !== "confirm" && action !== "decline") throw notFound("Ação");
    const ok = await ctx.gateways.sandbox.settleByPaymentId(id, action === "confirm" ? "confirmed" : "declined");
    if (!ok) throw notFound("Pagamento pendente no sandbox");
    return { ok: true };
  });
}
