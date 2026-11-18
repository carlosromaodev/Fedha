import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import type { CreateOrderBody, OrderView, PaymentMethod, PaymentView, QuoteBody } from "@fedha/contracts";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { AppError, forbidden, notFound, unprocessable } from "../../../shared/errors/app-error";
import { orderId as newOrderId } from "../../../shared/security/ids";
import { feeOf, startOfLuandaDay } from "../../../shared/money/money";
import { getSettings } from "../../admin/application/settings";
import { getPricing } from "../../pricing/application/pricing.service";
import { normalizeText, priceMessage } from "../../pricing/domain/pricing";
import { checkMessageText, isDonorBlocked } from "../../filters/application/filters.service";
import { assertNotSelfPayment } from "../../fraud/application/fraud.service";
import { acceptState, streamerByHandle, streamerById } from "../../streamers/application/streamers.service";
import { sortQueue } from "../../queue/domain/ordering";

export type Order = typeof schema.orders.$inferSelect;
export const PAID_STATES = ["queued", "playing", "played"] as const;

export async function quote(ctx: Ctx, handle: string, body: QuoteBody) {
  const s = await streamerByHandle(ctx, handle);
  const pricing = await getPricing(ctx, s.id);
  const r = priceMessage(pricing, body);
  const hit = body.kind === "text" && body.text ? await checkMessageText(ctx, s.id, body.text) : null;
  return { lines: r.lines, total: r.total, chars: r.chars, nextTier: r.nextTier, hit, problem: r.problem };
}

/** F1/F2 passo 4: o servidor valida (filtros, limites, streamer ativo) e cria o pedido com preço congelado. */
export async function createOrder(ctx: Ctx, handle: string, body: CreateOrderBody, ip: string | null): Promise<OrderView> {
  const s = await streamerByHandle(ctx, handle);
  const accept = await acceptState(ctx, s);
  if (accept.state !== "open" && accept.state !== "offline_queue")
    throw new AppError(409, `not_accepting_${accept.state}`, accept.message ?? "Este streamer não está a aceitar mensagens.");

  const settings = await getSettings(ctx);
  const pricing = await getPricing(ctx, s.id);
  const voiceId = body.kind === "text" ? body.voiceId ?? pricing.defaultVoiceId : null;
  if (voiceId && !(await ctx.db.query.voices.findFirst({ where: and(eq(schema.voices.id, voiceId), eq(schema.voices.active, true)) })))
    throw unprocessable("voice_invalid", "Voz indisponível.", { field: "voiceId" });
  const price = priceMessage(pricing, { ...body, voiceId: voiceId ?? undefined });
  if (price.problem) throw unprocessable(price.problem.code, price.problem.message, { field: price.problem.field });

  const text = body.kind === "text" ? normalizeText(body.text ?? "") : null;
  const donorName = body.anonymous || !body.donorName.trim() ? "Anónimo" : body.donorName.trim().replace(/\s+/g, " ");
  for (const [field, value] of [["text", text], ["donorName", body.anonymous ? null : donorName]] as const) {
    if (!value) continue;
    const hit = await checkMessageText(ctx, s.id, value);
    if (hit) throw unprocessable("filter_blocked", hit.message, { field, hit });
  }

  await assertNotSelfPayment(ctx, s.id, body.phone);
  if (await isDonorBlocked(ctx, s.id, body.phone, body.deviceId))
    throw forbidden("Não é possível enviar mensagens a este streamer a partir deste número ou dispositivo.", "donor_blocked");

  // Limites por doador (anti-abuso): por dia, por telemóvel ou dispositivo.
  if (body.phone || body.deviceId) {
    const since = startOfLuandaDay(ctx.now());
    const who = or(body.phone ? eq(schema.orders.donorPhone, body.phone) : undefined, body.deviceId ? eq(schema.orders.deviceId, body.deviceId) : undefined);
    const [r] = await ctx.db
      .select({ n: sql<string>`count(*)`, kz: sql<string>`coalesce(sum(${schema.orders.amount}), 0)` })
      .from(schema.orders)
      .where(and(who, gte(schema.orders.createdAt, since), inArray(schema.orders.status, [...PAID_STATES, "awaiting_payment"])));
    if (Number(r!.n) >= settings.donorDailyMaxMessages || Number(r!.kz) + price.total > settings.donorDailyMaxAmount)
      throw new AppError(429, "donor_limit", "Atingiste o limite diário de mensagens. Tenta amanhã.");
  }

  let audio: typeof schema.audioUploads.$inferSelect | undefined;
  if (body.kind === "audio") {
    if (!body.audioUploadId) throw unprocessable("audio_missing", "Grava o teu áudio antes de continuar.", { field: "audioUploadId" });
    audio = await ctx.db.query.audioUploads.findFirst({ where: eq(schema.audioUploads.id, body.audioUploadId) });
    if (!audio || audio.streamerId !== s.id || audio.deletedAt || audio.orderId || audio.expiresAt < ctx.now())
      throw unprocessable("audio_invalid", "O áudio expirou ou já foi usado. Grava de novo.", { field: "audioUploadId" });
    if (audio.durationMs > (body.audioTierSeconds ?? 0) * 1000 + 500)
      throw unprocessable("audio_too_long", "O áudio é mais longo do que o escalão escolhido.", { field: "audioTierSeconds" });
  }

  const feePercent = s.feePercent ?? settings.platformFeePercent;
  const feeAmount = feeOf(price.total, feePercent);
  const now = ctx.now();
  const id = newOrderId();
  await ctx.db.transaction(async (tx) => {
    await tx.insert(schema.orders).values({
      id, streamerId: s.id, donorName, anonymous: body.anonymous || donorName === "Anónimo", donorPhone: body.phone ?? null, deviceId: body.deviceId ?? null,
      kind: body.kind, text, voiceId, effectId: body.effectId ?? null, priority: !!body.priority, audioTierSeconds: body.audioTierSeconds ?? null,
      audioUploadId: audio?.id ?? null, lines: price.lines, amount: price.total, feePercent, feeAmount, netAmount: price.total - feeAmount,
      status: "awaiting_payment", offlineAtCreation: accept.state === "offline_queue", ip, createdAt: now,
      expiresAt: new Date(now.getTime() + 30 * 60_000),
    });
    if (audio) await tx.update(schema.audioUploads).set({ orderId: id }).where(eq(schema.audioUploads.id, audio.id));
  });
  return orderView(ctx, await getOrder(ctx, id));
}

export async function getOrder(ctx: Ctx, id: string): Promise<Order> {
  const o = await ctx.db.query.orders.findFirst({ where: eq(schema.orders.id, id.toUpperCase()) });
  if (!o) throw notFound("Pedido");
  return o;
}

export function paymentView(p: typeof schema.payments.$inferSelect): PaymentView {
  return {
    id: p.id, method: p.method as PaymentMethod, status: p.status as PaymentView["status"], amount: p.amount, expiresAt: p.expiresAt.toISOString(),
    phone: p.phone, reference: p.referenceEntity && p.referenceNumber ? { entity: p.referenceEntity, reference: p.referenceNumber, amount: p.amount } : null,
    redirectUrl: p.redirectUrl, failureReason: p.failureReason,
  };
}

/** Posição do pedido na fila (1 = a seguir) e espera estimada. */
export async function queuePosition(ctx: Ctx, o: Order) {
  if (o.status !== "queued") return { position: null, wait: null };
  const s = await streamerById(ctx, o.streamerId);
  const queued = await ctx.db.select().from(schema.orders).where(and(eq(schema.orders.streamerId, o.streamerId), eq(schema.orders.status, "queued")));
  const sorted = sortQueue(queued, s.queueOrder as "arrival" | "amount");
  const idx = sorted.findIndex((x) => x.id === o.id);
  const ahead = sorted.slice(0, idx);
  const wait = ahead.reduce((sum, x) => sum + Math.ceil(((x.durationMs ?? 8000) + s.intervalMs) / 1000), 0);
  return { position: idx + 1, wait };
}

export async function orderView(ctx: Ctx, o: Order): Promise<OrderView> {
  const s = await streamerById(ctx, o.streamerId);
  const payment = await ctx.db.query.payments.findFirst({ where: eq(schema.payments.orderId, o.id), orderBy: desc(schema.payments.createdAt) });
  const refund = await ctx.db.query.refunds.findFirst({ where: eq(schema.refunds.orderId, o.id), orderBy: desc(schema.refunds.createdAt) });
  const { position, wait } = await queuePosition(ctx, o);
  return {
    id: o.id,
    streamer: { handle: s.handle, displayName: s.displayName },
    donorName: o.donorName,
    kind: o.kind as "text" | "audio",
    text: o.text,
    lines: o.lines,
    amount: o.amount,
    status: o.status as OrderView["status"],
    statusReason: o.statusReason,
    queuePosition: position,
    estimatedWaitSeconds: wait,
    createdAt: o.createdAt.toISOString(),
    expiresAt: o.expiresAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    playedAt: o.playedAt?.toISOString() ?? null,
    payment: payment ? paymentView(payment) : null,
    refund: refund
      ? { status: refund.status as "processing" | "refunded" | "failed" | "awaiting_claim", amount: refund.amount, reason: refund.reason, claimDeadline: refund.claimDeadline?.toISOString() ?? null }
      : null,
  };
}

/** Atualiza a página do doador (SSE) e quem estiver a ouvir. */
export async function publishOrder(ctx: Ctx, id: string) {
  const o = await getOrder(ctx, id);
  ctx.hub.publishOrder(id, "order", await orderView(ctx, o));
}

/** P5 — consulta pelo número do pedido e telemóvel. */
export async function lookup(ctx: Ctx, id: string, phone: string) {
  const o = await ctx.db.query.orders.findFirst({ where: eq(schema.orders.id, id) });
  if (!o) throw notFound("Pedido");
  const payment = await ctx.db.query.payments.findFirst({ where: eq(schema.payments.orderId, o.id), orderBy: desc(schema.payments.createdAt) });
  if (o.donorPhone !== phone && payment?.phone !== phone) throw notFound("Pedido");
  return orderView(ctx, o);
}

/** Recibo simples (P4). */
export async function receipt(ctx: Ctx, id: string) {
  const o = await getOrder(ctx, id);
  if (!["queued", "playing", "played", "refund_pending", "refunded", "failed"].includes(o.status)) throw notFound("Recibo");
  const v = await orderView(ctx, o);
  return {
    orderId: v.id,
    streamer: v.streamer.displayName,
    donorName: v.donorName,
    lines: v.lines,
    total: v.amount,
    method: v.payment?.method ?? null,
    paidAt: v.paidAt,
    status: v.status,
  };
}
