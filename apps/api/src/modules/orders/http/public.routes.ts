import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  CheckTextBody, CreateOrderBody, CreatePaymentBody, OrderLookupBody, QuoteBody, RefundClaimBody,
} from "@fedha/contracts";
import type { Ctx } from "../../../shared/context";
import { schema } from "../../../shared/database/client";
import { badRequest, notFound, unprocessable } from "../../../shared/errors/app-error";
import { uuid } from "../../../shared/security/ids";
import { ipOf } from "../../../shared/http/auth";
import { extForMime, isPublicKey } from "../../../integrations/storage/storage";
import { getSettings } from "../../admin/application/settings";
import { getPricing } from "../../pricing/application/pricing.service";
import { countChars } from "../../pricing/domain/pricing";
import { checkMessageText } from "../../filters/application/filters.service";
import * as streamers from "../../streamers/application/streamers.service";
import { activeGoal } from "../../goals/application/goals.service";
import * as orders from "../application/orders.service";
import * as payments from "../../payments/application/payments.service";
import { FAQ } from "../../support/application/support.service";

const METHOD_LABEL = { mcx: "Multicaixa Express", reference: "Referência Multicaixa", unitel_money: "Unitel Money", afrimoney: "Afrimoney", card: "Cartão Visa/Mastercard" } as const;

async function catalog(ctx: Ctx) {
  const voices = await ctx.db.select().from(schema.voices).where(eq(schema.voices.active, true));
  const effects = await ctx.db.select().from(schema.soundEffects).where(eq(schema.soundEffects.active, true));
  return {
    voices: voices.map((v) => ({ id: v.id, name: v.name, description: v.description, premium: v.premium, sampleUrl: ctx.storage.publicUrl(`samples/voice-${v.id}.wav`) })),
    effects: effects.map((e) => ({ id: e.id, name: e.name, url: e.storageKey ? ctx.storage.publicUrl(e.storageKey) : null })),
  };
}

export async function publicRoutes(app: FastifyInstance, ctx: Ctx) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const Handle = z.object({ handle: z.string() });
  const Id = z.object({ id: z.string() });

  // ----------------------------------------------------------- P1
  r.get("/v1/public/platform", async () => {
    const s = await getSettings(ctx);
    return {
      platformFeePercent: s.platformFeePercent, withdrawalFee: s.withdrawalFee, withdrawalMin: s.withdrawalMin, retentionHours: s.retentionHours,
      methods: (Object.keys(METHOD_LABEL) as (keyof typeof METHOD_LABEL)[]).map((id) => ({ id, label: METHOD_LABEL[id], active: s.activeMethods.includes(id) })),
      ...(await catalog(ctx)),
    };
  });
  r.get("/v1/public/faq", async () => ({ items: FAQ }));
  r.get("/v1/public/streamers", { schema: { querystring: z.object({ q: z.string().min(2).max(40) }) } }, async (req) => ({ items: await streamers.search(ctx, req.query.q) }));

  // ----------------------------------------------------------- P2
  r.get("/v1/public/streamers/:handle", { schema: { params: Handle } }, async (req) => {
    const s = await streamers.streamerByHandle(ctx, req.params.handle);
    if (s.status !== "active") throw notFound("Streamer");
    const settings = await getSettings(ctx);
    const accept = await streamers.acceptState(ctx, s);
    return {
      id: s.id, handle: s.handle, displayName: s.displayName, bio: s.bio, avatarUrl: s.avatarUrl, bannerUrl: s.bannerUrl, socials: s.socials,
      verified: s.kycStatus === "approved", isLive: streamers.isEffectivelyLive(ctx, s), platform: s.platform,
      acceptState: accept.state, acceptMessage: accept.message, thankYouMessage: s.thankYouMessage,
      pricing: await getPricing(ctx, s.id), ...(await catalog(ctx)), methods: settings.activeMethods,
      goal: await activeGoal(ctx, s.id),
      recentMessages: s.showRecentMessages ? await streamers.recentPlayed(ctx, s.id, 5) : null,
      topDonors: s.showTopDonors ? await streamers.topDonors(ctx, s.id, new Date(ctx.now().getTime() - 30 * 86400_000), 5) : null,
    };
  });

  r.post("/v1/public/streamers/:handle/check", { schema: { params: Handle, body: CheckTextBody } }, async (req) => {
    const s = await streamers.streamerByHandle(ctx, req.params.handle);
    const hit = await checkMessageText(ctx, s.id, req.body.text);
    return { ok: !hit, chars: countChars(req.body.text), hit };
  });

  r.post("/v1/public/streamers/:handle/quote", { schema: { params: Handle, body: QuoteBody } }, async (req) => orders.quote(ctx, req.params.handle, req.body));

  r.post("/v1/public/streamers/:handle/orders", {
    schema: { params: Handle, body: CreateOrderBody },
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (req, reply) => reply.status(201).send(await orders.createOrder(ctx, req.params.handle, req.body, ipOf(req))));
  /** O mesmo, com o handle no corpo (usado pelo painel e pelos testes do overlay). */
  r.post("/v1/public/orders", {
    schema: { body: CreateOrderBody.extend({ handle: z.string().trim().toLowerCase() }) },
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const { handle, ...body } = req.body;
    return reply.status(201).send(await orders.createOrder(ctx, handle, body, ipOf(req)));
  });

  // ----------------------------------------------------------- áudio gravado (F2)
  r.post("/v1/public/audio-uploads", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const parts = req.parts({ limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
    const fields: Record<string, string> = {};
    let file: { data: Buffer; mime: string } | null = null;
    for await (const part of parts) {
      if (part.type === "file") {
        if (!part.mimetype.startsWith("audio/")) throw unprocessable("file_type", "Envia um ficheiro de áudio.", { field: "file" });
        const data = await part.toBuffer();
        if (part.file.truncated) throw unprocessable("file_too_large", "O áudio é demasiado grande (máx. 2 MB).", { field: "file" });
        file = { data, mime: part.mimetype };
      } else fields[part.fieldname] = String(part.value);
    }
    if (!file || file.data.length < 500) throw badRequest("audio_missing", "Áudio em falta ou vazio.", { field: "file" });
    const s = await streamers.streamerByHandle(ctx, fields.handle ?? "");
    const pricing = await getPricing(ctx, s.id);
    if (!pricing.audioEnabled) throw unprocessable("audio_disabled", "Este streamer não aceita áudio gravado.");
    const maxMs = Math.max(...pricing.audioTiers.map((t) => t.seconds)) * 1000 + 500;
    const durationMs = Math.round(Number(fields.durationMs));
    if (!Number.isFinite(durationMs) || durationMs < 2000) throw unprocessable("audio_too_short", "O áudio tem de ter pelo menos 2 segundos.", { field: "durationMs" });
    if (durationMs > maxMs) throw unprocessable("audio_too_long", "O áudio é mais longo do que o permitido.", { field: "durationMs" });
    const id = uuid();
    const key = `audio/${s.id}/up-${id}.${extForMime(file.mime)}`;
    await ctx.storage.put(key, file.data, file.mime);
    const expiresAt = new Date(ctx.now().getTime() + 24 * 3600_000);
    await ctx.db.insert(schema.audioUploads).values({ id, streamerId: s.id, storageKey: key, mime: file.mime, sizeBytes: file.data.length, durationMs, expiresAt, createdAt: ctx.now() });
    return reply.status(201).send({ uploadId: id, durationMs, expiresAt: expiresAt.toISOString() });
  });

  // ----------------------------------------------------------- P3 / P4 / P5
  r.post("/v1/public/orders/:id/payments", { schema: { params: Id, body: CreatePaymentBody }, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => reply.status(201).send(await payments.createPayment(ctx, req.params.id, req.body, ipOf(req))));

  r.get("/v1/public/orders/:id", { schema: { params: Id } }, async (req) => orders.orderView(ctx, await orders.getOrder(ctx, req.params.id)));

  /** SSE: o estado do pedido atualiza-se sozinho (a aguardar, confirmado, na fila, a tocar, tocada…). */
  r.get("/v1/public/orders/:id/events", { schema: { params: Id } }, async (req, reply) => {
    const order = await orders.getOrder(ctx, req.params.id);
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": (req.headers.origin as string) ?? "*",
    });
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send("order", await orders.orderView(ctx, order));
    const off = ctx.hub.subscribeOrder(order.id, send);
    const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
    req.raw.on("close", () => { off(); clearInterval(ping); });
  });

  r.post("/v1/public/orders/lookup", { schema: { body: OrderLookupBody }, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req) => orders.lookup(ctx, req.body.orderId, req.body.phone));

  r.post("/v1/public/orders/:id/refund-claim", { schema: { params: Id, body: RefundClaimBody }, config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req) => payments.claimRefund(ctx, req.params.id, req.body.phone, req.body.mcxPhone));

  r.get("/v1/public/orders/:id/receipt", { schema: { params: Id } }, async (req) => orders.receipt(ctx, req.params.id));

  /** "Ouvir como vai soar" antes de pagar. */
  r.get("/v1/public/tts-preview", {
    schema: { querystring: z.object({ text: z.string().min(1).max(300), voiceId: z.string().optional(), handle: z.string().optional() }) },
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    if (req.query.handle) {
      const s = await streamers.streamerByHandle(ctx, req.query.handle);
      const hit = await checkMessageText(ctx, s.id, req.query.text);
      if (hit) throw unprocessable("filter_blocked", hit.message, { hit });
    }
    const voice = req.query.voiceId ? await ctx.db.query.voices.findFirst({ where: eq(schema.voices.id, req.query.voiceId) }) : null;
    const out = await ctx.tts.synthesize(req.query.text, { provider: voice?.provider ?? "default", providerVoiceId: voice?.providerVoiceId ?? "" });
    return reply.header("Content-Type", out.mime).header("Cache-Control", "no-store").send(out.data);
  });

  // ----------------------------------------------------------- ficheiros públicos (áudio, efeitos, imagens)
  app.get("/media/*", async (req, reply) => {
    const key = (req.params as { "*": string })["*"];
    if (!isPublicKey(key)) throw notFound("Ficheiro");
    const file = await ctx.storage.get(key);
    if (!file) throw notFound("Ficheiro");
    return reply.header("Content-Type", file.mime).header("Cache-Control", "public, max-age=86400").header("Access-Control-Allow-Origin", "*").send(file.data);
  });
}
