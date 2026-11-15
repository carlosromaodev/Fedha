import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { Password } from "@fedha/contracts";
import type { Ctx } from "../../../shared/context";
import { meta, optionalAuth, requireAuth, user } from "../../../shared/http/auth";
import * as assistants from "../application/assistants.service";
import { snapshot } from "../../queue/application/queue.service";
import * as playback from "../../playback/application/playback.service";
import { ensureWidgets, widgetUrl } from "../../playback/application/widgets.service";
import { login, userById } from "../../auth/application/auth.service";

/** 5.4 — painel do assistente: só a fila (acompanhamento) e o Player dos streamers que o convidaram. */
export async function assistantRoutes(app: FastifyInstance, ctx: Ctx) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const A = { preHandler: requireAuth(ctx, ["assistant"]) };
  const Token = z.object({ token: z.string() });
  const Sid = z.object({ id: z.string() });

  r.get("/v1/assistant/invites/:token", { schema: { params: Token } }, async (req) => assistants.inviteInfo(ctx, req.params.token));
  r.post("/v1/assistant/invites/:token/accept", {
    preHandler: optionalAuth(ctx),
    schema: { params: Token, body: z.object({ displayName: z.string().trim().min(2).max(40).optional(), password: Password.optional() }).default({}) },
  }, async (req) => {
    const current = req.auth?.user ?? null;
    const res = await assistants.accept(ctx, req.params.token, current, req.body);
    if (res.created) {
      const u = await userById(ctx, res.userId);
      return login(ctx, u.phone ?? u.email, req.body.password!, meta(req));
    }
    return { ok: true };
  });

  r.get("/v1/assistant/streamers", A, async (req) => ({ items: await assistants.streamersOf(ctx, user(req).id) }));
  r.get("/v1/assistant/streamers/:id/queue", { ...A, schema: { params: Sid } }, async (req) => {
    await assistants.assertAssistantOf(ctx, user(req).id, req.params.id);
    return snapshot(ctx, req.params.id);
  });
  /** Link do Player (S3) do streamer, para abrir no aparelho ligado à coluna. */
  r.post("/v1/assistant/streamers/:id/player-token", { ...A, schema: { params: Sid } }, async (req) => {
    const s = await assistants.assertAssistantOf(ctx, user(req).id, req.params.id);
    const row = (await ensureWidgets(ctx, s.id)).find((w) => w.kind === "player")!;
    return { url: widgetUrl(ctx, "player", row.token), token: row.token };
  });
  r.put("/v1/assistant/streamers/:id/volume", { ...A, schema: { params: Sid, body: z.object({ volume: z.number().int().min(0).max(100) }) } }, async (req) => {
    const s = await assistants.assertAssistantOf(ctx, user(req).id, req.params.id);
    await playback.setVolume(ctx, s, req.body.volume, { id: user(req).id, type: "assistant" });
    return { volume: req.body.volume };
  });
  r.post("/v1/assistant/streamers/:id/test-sound", { ...A, schema: { params: Sid } }, async (req) => {
    const s = await assistants.assertAssistantOf(ctx, user(req).id, req.params.id);
    return playback.testAlert(ctx, s, { id: user(req).id, type: "assistant" });
  });
}
