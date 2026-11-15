import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { loadEnv, type Env } from "./shared/config/env";
import { createDb } from "./shared/database/client";
import { EventBus } from "./shared/events/bus";
import { RealtimeHub } from "./shared/realtime/hub";
import { Scheduler } from "./shared/jobs/scheduler";
import { registerErrorHandler } from "./shared/http/errors";
import type { Ctx } from "./shared/context";
import { LocalStorage, MemoryStorage, type Storage } from "./integrations/storage/storage";
import { AzureTts, MockTts, type TtsEngine } from "./integrations/tts/tts";
import { DefaultMessenger } from "./integrations/messaging/senders";
import { SandboxGateway } from "./integrations/payments/sandbox";
import { PendingContractGateway, ProxyPayGateway } from "./integrations/payments/providers";
import type { PaymentGateway, PaymentMethod } from "./integrations/payments/gateway";
import { handleWebhook } from "./modules/payments/application/payments.service";
import { PlaybackEngine } from "./modules/playback/application/engine";
import { setEngine, prepareAudio, pushWidgetData } from "./modules/playback/application/playback.service";
import { publishSnapshot } from "./modules/queue/application/queue.service";
import { checkPaidOrder } from "./modules/fraud/application/fraud.service";
import { notifyStreamer } from "./modules/notifications/application/notifications.service";
import { ensureSuperAdmin } from "./modules/auth/application/auth.service";
import { buildJobs } from "./jobs";
import { seedCatalog, seedDemo } from "./seed";
import { formatKz } from "./shared/money/money";
import { publicRoutes } from "./modules/orders/http/public.routes";
import { webhookRoutes } from "./modules/payments/http/webhooks.routes";
import { authRoutes } from "./modules/auth/http/auth.routes";
import { streamerRoutes } from "./modules/streamers/http/streamer.routes";
import { assistantRoutes } from "./modules/assistants/http/assistant.routes";
import { realtimeRoutes } from "./modules/playback/http/realtime.routes";
import { widgetRoutes } from "./modules/playback/http/widgets.routes";
import { adminRoutes } from "./modules/admin/http/admin.routes";

export interface BuildOptions {
  env?: Partial<Record<keyof Env, string>>;
  /** Testes: armazenamento em memória e relógio controlado. */
  storage?: Storage;
  now?: () => Date;
  logger?: boolean;
}

export async function buildApp(opts: BuildOptions = {}): Promise<{ app: FastifyInstance; ctx: Ctx; scheduler: Scheduler }> {
  const env = loadEnv({ ...process.env, ...(opts.env ?? {}) });
  const app = Fastify({
    logger: opts.logger === false ? false : { level: env.NODE_ENV === "production" ? "info" : "debug", redact: ["req.headers.authorization"] },
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  const { db, close } = await createDb(env.DATABASE_URL);
  const bus = new EventBus((err, event) => app.log.error({ err, event }, "evento falhou"));
  const hub = new RealtimeHub();
  const storage = opts.storage ?? (env.NODE_ENV === "test" ? new MemoryStorage(env.PUBLIC_API_URL) : new LocalStorage(env.STORAGE_DIR, env.PUBLIC_API_URL));
  const tts: TtsEngine = env.TTS_PROVIDER === "azure" && env.AZURE_TTS_KEY && env.AZURE_TTS_REGION ? new AzureTts(env.AZURE_TTS_KEY, env.AZURE_TTS_REGION) : new MockTts();
  const messenger = new DefaultMessenger(env, app.log);

  const sandbox = new SandboxGateway(env.SANDBOX_WEBHOOK_SECRET, env.NODE_ENV === "test" ? 0 : env.SANDBOX_AUTO_CONFIRM_MS);
  const proxypay = new ProxyPayGateway(env.PROXYPAY_API_KEY, env.PROXYPAY_ENV, env.PROXYPAY_ENTITY);
  const appypay = new PendingContractGateway("appypay", ["APPYPAY_CLIENT_ID", "APPYPAY_CLIENT_SECRET", "documentação da API do parceiro"]);
  const emis = new PendingContractGateway("emis", ["EMIS_GPO_TOKEN", "contrato EMIS GPO"]);
  const named: Record<string, PaymentGateway> = { sandbox, proxypay, appypay, emis };
  const byMethod: Record<PaymentMethod, PaymentGateway> = {
    mcx: named[env.PAYMENTS_MCX_PROVIDER]!,
    reference: named[env.PAYMENTS_REFERENCE_PROVIDER]!,
    unitel_money: named[env.PAYMENTS_WALLET_PROVIDER]!,
    afrimoney: named[env.PAYMENTS_WALLET_PROVIDER]!,
    card: named[env.PAYMENTS_CARD_PROVIDER]!,
  };

  const ctx: Ctx = {
    env, db, log: app.log, bus, hub, storage, tts, messenger, now: opts.now ?? (() => new Date()),
    gateways: { forMethod: (m) => byMethod[m], byName: (n) => named[n], all: () => [...new Set(Object.values(byMethod))], sandbox },
  };
  sandbox.deliver = async (headers, body) => { await handleWebhook(ctx, "sandbox", headers, body); };

  const engine = new PlaybackEngine(ctx);
  setEngine(ctx, engine);

  // Reações a eventos de domínio.
  bus.on("order.paid", async ({ orderId, streamerId }) => {
    await prepareAudio(ctx, orderId);
    await checkPaidOrder(ctx, orderId);
    await pushWidgetData(ctx, streamerId);
    const o = await db.query.orders.findFirst({ where: (t, { eq }) => eq(t.id, orderId) });
    if (o) await notifyStreamer(ctx, streamerId, "new_message", "Nova mensagem", `${o.donorName} enviou ${formatKz(o.amount)}.`, { orderId });
  });
  bus.on("order.played", async ({ streamerId }) => pushWidgetData(ctx, streamerId));
  bus.on("order.failed", async ({ streamerId }) => { await publishSnapshot(ctx, streamerId); await pushWidgetData(ctx, streamerId); });
  bus.on("goal.updated", async ({ streamerId }) => pushWidgetData(ctx, streamerId));

  await app.register(cors, {
    origin: (origin, cb) => {
      const allowed = env.CORS_ORIGINS.split(",").map((s) => s.trim());
      cb(null, !origin || allowed.includes("*") || allowed.includes(origin));
    },
    credentials: true,
  });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute", enableDraftSpec: true });
  await app.register(multipart, { limits: { fileSize: 8 * 1024 * 1024, files: 5 } });
  await app.register(websocket, { options: { maxPayload: 64 * 1024 } });

  app.get("/health", async () => ({ ok: true, at: ctx.now().toISOString() }));
  await publicRoutes(app, ctx);
  await webhookRoutes(app, ctx);
  await authRoutes(app, ctx);
  await streamerRoutes(app, ctx);
  await assistantRoutes(app, ctx);
  await realtimeRoutes(app, ctx);
  await widgetRoutes(app, ctx);
  await adminRoutes(app, ctx);

  await seedCatalog(ctx);
  await ensureSuperAdmin(ctx);
  if (env.SEED_DEMO) await seedDemo(ctx);
  await engine.recover();

  const scheduler = new Scheduler(app.log);
  if (env.JOBS_ENABLED && env.NODE_ENV !== "test") scheduler.start(buildJobs(ctx));

  app.addHook("onClose", async () => {
    scheduler.stop();
    engine.stop();
    hub.closeAll();
    await close();
  });
  return { app, ctx, scheduler };
}
