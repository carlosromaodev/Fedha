import { and, desc, eq, inArray, isNull, lt, ne } from "drizzle-orm";
import type { CreatePaymentBody } from "@fedha/contracts";
import { schema, type DbOrTx } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { AppError, badRequest, conflict, notFound, unauthorized, unprocessable } from "../../../shared/errors/app-error";
import { uuid } from "../../../shared/security/ids";
import { audit } from "../../../shared/audit/audit";
import { getSettings } from "../../admin/application/settings";
import { ProviderNotConfiguredError, type PaymentMethod } from "../../../integrations/payments/gateway";
import { getOrder, orderView, publishOrder, type Order } from "../../orders/application/orders.service";
import { acceptState, streamerById } from "../../streamers/application/streamers.service";
import { creditOrder, receiveForRefund, refundPaidOut, reverseOrder } from "../../wallet/application/wallet.service";

type Payment = typeof schema.payments.$inferSelect;

const TTL_MIN: Record<PaymentMethod, (s: Awaited<ReturnType<typeof getSettings>>) => number> = {
  mcx: (s) => s.mcxTtlMinutes,
  unitel_money: (s) => s.mcxTtlMinutes,
  afrimoney: (s) => s.mcxTtlMinutes,
  reference: (s) => s.referenceTtlMinutes,
  card: () => 15,
};

/** P3 — inicia o pagamento do pedido pelo método escolhido. "Tentar de novo" e "Mudar método" chamam isto outra vez. */
export async function createPayment(ctx: Ctx, orderId: string, body: CreatePaymentBody, ip: string | null) {
  const order = await getOrder(ctx, orderId);
  const now = ctx.now();
  if (!["awaiting_payment", "payment_failed"].includes(order.status))
    throw conflict("order_not_payable", order.status === "expired" ? "Este pedido expirou. Cria um novo." : "Este pedido já não aceita pagamentos.");
  const settings = await getSettings(ctx);
  if (!settings.activeMethods.includes(body.method)) throw unprocessable("method_unavailable", "Este método de pagamento não está disponível.", { field: "method" });
  if (["mcx", "unitel_money", "afrimoney"].includes(body.method) && !body.phone)
    throw unprocessable("phone_required", "Indica o número de telemóvel associado à conta.", { field: "phone" });

  const ttl = TTL_MIN[body.method](settings);
  const expiresAt = new Date(now.getTime() + ttl * 60_000);
  const gateway = ctx.gateways.forMethod(body.method);
  const id = uuid();

  // Pagamentos pendentes anteriores deste pedido deixam de valer (se chegarem, são tratados como duplicados).
  await ctx.db.update(schema.payments).set({ status: "expired", failureReason: "Substituído por outro pagamento.", updatedAt: now })
    .where(and(eq(schema.payments.orderId, order.id), inArray(schema.payments.status, ["created", "pending"])));
  await ctx.db.insert(schema.payments).values({
    id, orderId: order.id, method: body.method, provider: gateway.name, status: "created", amount: order.amount, phone: body.phone ?? order.donorPhone ?? null,
    expiresAt, createdAt: now, updatedAt: now,
  });

  let result;
  try {
    result = await gateway.createCharge({
      paymentId: id, orderId: order.id, method: body.method, amount: order.amount, phone: body.phone, expiresAt,
      description: `Fedha Live ${order.id}`, returnUrl: `${ctx.env.PUBLIC_WEB_URL}/pedido/${order.id}`,
    });
  } catch (err) {
    const reason = err instanceof ProviderNotConfiguredError ? err.message : "O serviço de pagamentos não respondeu. Tenta de novo ou muda de método.";
    await ctx.db.update(schema.payments).set({ status: "error", failureReason: reason, updatedAt: ctx.now() }).where(eq(schema.payments.id, id));
    ctx.log.error({ err, paymentId: id }, "falha ao criar cobrança");
    throw new AppError(502, "gateway_error", reason);
  }

  const status = result.status === "declined" ? "declined" : result.status === "error" ? "error" : "pending";
  await ctx.db.update(schema.payments).set({
    providerRef: result.providerRef, status, referenceEntity: result.referenceEntity ?? null, referenceNumber: result.referenceNumber ?? null,
    redirectUrl: result.redirectUrl ?? null, failureReason: result.failureReason ?? null, raw: result.raw ?? null, updatedAt: ctx.now(),
  }).where(eq(schema.payments.id, id));
  await ctx.db.update(schema.orders).set({
    status: status === "pending" ? "awaiting_payment" : "payment_failed",
    statusReason: status === "pending" ? null : result.failureReason ?? "Pagamento recusado.",
    expiresAt,
    donorPhone: order.donorPhone ?? body.phone ?? null,
  }).where(eq(schema.orders.id, order.id));
  await audit(ctx, { actorType: "donor", action: "payment.created", targetType: "payment", targetId: id, data: { orderId: order.id, method: body.method }, ip });
  await publishOrder(ctx, order.id);
  if (result.status === "confirmed") await confirmPayment(ctx, id, order.amount);
  return orderView(ctx, await getOrder(ctx, order.id));
}

// ------------------------------------------------------------- webhooks
/** Webhook assinado do gateway. Idempotente: o mesmo evento duas vezes não faz nada. */
export async function handleWebhook(ctx: Ctx, provider: string, headers: Record<string, string | string[] | undefined>, rawBody: string) {
  const gateway = ctx.gateways.byName(provider);
  if (!gateway) throw notFound("Fornecedor");
  const ok = gateway.verifyWebhook(headers, rawBody);
  let body: unknown;
  try { body = JSON.parse(rawBody); } catch { throw badRequest("invalid_json", "Corpo inválido."); }
  if (!ok) {
    await ctx.db.insert(schema.webhookEvents).values({ id: uuid(), provider, eventId: `invalid-${uuid()}`, payload: body, signatureOk: false, error: "assinatura inválida", createdAt: ctx.now() });
    throw unauthorized("Assinatura inválida.", "invalid_signature");
  }
  const ev = gateway.parseWebhook(body);
  const inserted = await ctx.db.insert(schema.webhookEvents)
    .values({ id: uuid(), provider, eventId: ev.eventId, payload: body, signatureOk: true, createdAt: ctx.now() })
    .onConflictDoNothing()
    .returning({ id: schema.webhookEvents.id });
  if (inserted.length === 0) return { duplicate: true };
  const eventRowId = inserted[0]!.id;

  try {
    const payment = ev.paymentId
      ? await ctx.db.query.payments.findFirst({ where: eq(schema.payments.id, ev.paymentId) })
      : await ctx.db.query.payments.findFirst({ where: and(eq(schema.payments.provider, provider), eq(schema.payments.providerRef, ev.providerRef ?? "")) });
    if (!payment) throw new Error(`pagamento desconhecido (${ev.paymentId ?? ev.providerRef})`);
    if (ev.status === "confirmed") await confirmPayment(ctx, payment.id, ev.amount ?? payment.amount);
    else if (ev.status === "declined" || ev.status === "expired" || ev.status === "error") await failPayment(ctx, payment.id, ev.status);
    await ctx.db.update(schema.webhookEvents).set({ processedAt: ctx.now() }).where(eq(schema.webhookEvents.id, eventRowId));
  } catch (err) {
    await ctx.db.update(schema.webhookEvents).set({ error: String(err) }).where(eq(schema.webhookEvents.id, eventRowId));
    ctx.log.error({ err, provider, eventId: ev.eventId }, "webhook não processado");
  }
  return { duplicate: false };
}

/**
 * Pagamento confirmado pelo gateway (nunca pelo retorno do browser).
 * - pedido à espera → pago, entra na fila e o líquido fica pendente no ledger;
 * - pedido expirado → reativado se o streamer ainda aceitar, senão reembolsado;
 * - pedido já pago (pagamento duplicado) ou valor diferente → reembolsado.
 */
export async function confirmPayment(ctx: Ctx, paymentId: string, receivedAmount: number) {
  const now = ctx.now();
  let outcome = "noop" as "queued" | "refund" | "noop";
  let refundReason = "";
  let orderId = "";
  // Decidido antes da transação: o PGlite tem uma só ligação e não pode ler fora da transação aberta.
  const pre = await ctx.db.query.payments.findFirst({ where: eq(schema.payments.id, paymentId) });
  if (!pre) return;
  const preOrder = await getOrder(ctx, pre.orderId);
  let lateAccepted = false;
  if (preOrder.status === "expired") {
    const st = await acceptState(ctx, await streamerById(ctx, preOrder.streamerId));
    lateAccepted = st.state === "open" || st.state === "offline_queue";
  }
  await ctx.db.transaction(async (tx) => {
    const p = await tx.query.payments.findFirst({ where: eq(schema.payments.id, paymentId) });
    if (!p || p.status === "confirmed" || p.status.startsWith("refund")) return;
    const o = (await tx.query.orders.findFirst({ where: eq(schema.orders.id, p.orderId) }))!;
    orderId = o.id;
    await tx.update(schema.payments).set({ status: "confirmed", confirmedAt: now, updatedAt: now }).where(eq(schema.payments.id, p.id));

    const otherConfirmed = await tx.query.payments.findFirst({ where: and(eq(schema.payments.orderId, o.id), eq(schema.payments.status, "confirmed"), ne(schema.payments.id, p.id)) });
    let payable = ["awaiting_payment", "payment_failed"].includes(o.status) && !otherConfirmed;
    if (o.status === "expired" && !otherConfirmed) {
      payable = lateAccepted;
      if (!payable) refundReason = "O pagamento chegou depois de o pedido expirar.";
    }
    if (receivedAmount !== o.amount) {
      payable = false;
      refundReason = `Valor recebido (${receivedAmount} Kz) diferente do pedido (${o.amount} Kz).`;
    }
    if (payable) {
      await tx.update(schema.orders).set({ status: "queued", statusReason: null, paidAt: now }).where(eq(schema.orders.id, o.id));
      await creditOrder(tx, { ...o, paidAt: now }, now);
      outcome = "queued";
    } else {
      refundReason ||= "Pagamento duplicado.";
      await receiveForRefund(tx, p.id, receivedAmount, now);
      outcome = "refund";
    }
  });
  if (outcome === "queued") {
    await audit(ctx, { actorType: "system", action: "order.paid", targetType: "order", targetId: orderId });
    ctx.bus.emit("order.paid", { orderId, streamerId: (await getOrder(ctx, orderId)).streamerId });
  } else if (outcome === "refund") {
    await startRefund(ctx, paymentId, refundReason, { countsAgainstOrder: false });
  }
  if (orderId) await publishOrder(ctx, orderId);
}

export async function failPayment(ctx: Ctx, paymentId: string, status: "declined" | "expired" | "error", reason?: string) {
  const p = await ctx.db.query.payments.findFirst({ where: eq(schema.payments.id, paymentId) });
  if (!p || !["created", "pending"].includes(p.status)) return;
  const msg = reason ?? (status === "declined" ? "Pagamento recusado." : status === "expired" ? "O prazo para pagar terminou." : "Erro no pagamento.");
  await ctx.db.update(schema.payments).set({ status, failureReason: msg, updatedAt: ctx.now() }).where(eq(schema.payments.id, p.id));
  const o = await getOrder(ctx, p.orderId);
  if (o.status === "awaiting_payment") {
    const next = status === "expired" ? "expired" : "payment_failed";
    await ctx.db.update(schema.orders).set({ status: next, statusReason: msg }).where(eq(schema.orders.id, o.id));
  }
  ctx.bus.emit("payment.updated", { paymentId, orderId: p.orderId, status });
  await publishOrder(ctx, p.orderId);
}

// ------------------------------------------------------------- reembolsos (F4)
/**
 * Falha técnica: a mensagem não pôde ser emitida (TTS, áudio corrompido) ou não tocou em 7 dias.
 * O pedido passa a "falhou", o ledger regista a reversão e é criado o reembolso.
 */
export async function failOrder(ctx: Ctx, orderId: string, reason: string, actor: { id?: string; type: "system" | "admin" } = { type: "system" }) {
  const now = ctx.now();
  let paymentId: string | null = null;
  await ctx.db.transaction(async (tx) => {
    const o = await tx.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
    if (!o || !["queued", "playing", "played"].includes(o.status)) return;
    await tx.update(schema.orders).set({ status: "failed", statusReason: reason, failedAt: now }).where(eq(schema.orders.id, o.id));
    await reverseOrder(tx, o, now, !!o.releasedAt);
    const p = await tx.query.payments.findFirst({ where: and(eq(schema.payments.orderId, o.id), eq(schema.payments.status, "confirmed")) });
    paymentId = p?.id ?? null;
  });
  await audit(ctx, { actorId: actor.id, actorType: actor.type, action: "order.failed", targetType: "order", targetId: orderId, data: { reason } });
  const o = await getOrder(ctx, orderId);
  ctx.bus.emit("order.failed", { orderId, streamerId: o.streamerId, reason });
  if (paymentId) await startRefund(ctx, paymentId, reason, { countsAgainstOrder: true });
  await publishOrder(ctx, orderId);
}

/**
 * Reembolso pelo mesmo método quando o gateway suporta; senão para o Multicaixa Express do doador;
 * sem contacto, fica para reclamação durante 90 dias na consulta de pedido (P5).
 */
export async function startRefund(ctx: Ctx, paymentId: string, reason: string, opts: { countsAgainstOrder: boolean }) {
  const p = (await ctx.db.query.payments.findFirst({ where: eq(schema.payments.id, paymentId) }))!;
  const o = await getOrder(ctx, p.orderId);
  const settings = await getSettings(ctx);
  const now = ctx.now();
  const id = uuid();
  const phone = p.phone ?? o.donorPhone;
  await ctx.db.insert(schema.refunds).values({ id, orderId: o.id, paymentId: p.id, amount: p.amount, reason, status: "processing", destinationPhone: phone, createdAt: now });
  await ctx.db.update(schema.payments).set({ status: "refund_requested", updatedAt: now }).where(eq(schema.payments.id, p.id));
  if (opts.countsAgainstOrder) await ctx.db.update(schema.orders).set({ status: "refund_pending" }).where(eq(schema.orders.id, o.id));

  let res: Awaited<ReturnType<ReturnType<Ctx["gateways"]["forMethod"]>["refund"]>>;
  try {
    res = await ctx.gateways.forMethod(p.method as PaymentMethod).refund({ paymentId: p.id, providerRef: p.providerRef ?? "", amount: p.amount, phone });
  } catch (err) {
    ctx.log.error({ err, refundId: id }, "reembolso falhou no gateway");
    res = { status: "manual" };
  }
  if (res.status === "refunded") return completeRefund(ctx, id, res.providerRef ?? null);
  if (res.status === "manual" && !phone) {
    await ctx.db.update(schema.refunds).set({ status: "awaiting_claim", claimDeadline: new Date(now.getTime() + settings.unclaimedRefundDays * 86400_000) }).where(eq(schema.refunds.id, id));
  }
  await notifyDonorRefund(ctx, o, phone, p.amount, res.status === "manual" && !phone ? "claim" : "processing");
  await publishOrder(ctx, o.id);
  return id;
}

export async function completeRefund(ctx: Ctx, refundId: string, providerRef: string | null, actor?: { id: string }) {
  const now = ctx.now();
  const r = await ctx.db.query.refunds.findFirst({ where: eq(schema.refunds.id, refundId) });
  if (!r || r.status === "refunded") return refundId;
  await ctx.db.transaction(async (tx) => {
    await tx.update(schema.refunds).set({ status: "refunded", providerRef, completedAt: now }).where(eq(schema.refunds.id, r.id));
    await tx.update(schema.payments).set({ status: "refunded", updatedAt: now }).where(eq(schema.payments.id, r.paymentId));
    await refundPaidOut(tx, r.id, r.amount, now);
    const o = await tx.query.orders.findFirst({ where: eq(schema.orders.id, r.orderId) });
    if (o && ["refund_pending", "failed"].includes(o.status)) await tx.update(schema.orders).set({ status: "refunded", refundedAt: now }).where(eq(schema.orders.id, o.id));
  });
  if (actor) await audit(ctx, { actorId: actor.id, actorType: "admin", action: "refund.marked_paid", targetType: "refund", targetId: refundId });
  const o = await getOrder(ctx, r.orderId);
  await notifyDonorRefund(ctx, o, r.destinationPhone, r.amount, "done");
  await publishOrder(ctx, r.orderId);
  return refundId;
}

/** P5 — o doador sem contacto indica o número Multicaixa Express para receber o reembolso. */
export async function claimRefund(ctx: Ctx, orderId: string, phone: string, mcxPhone: string) {
  const o = await getOrder(ctx, orderId);
  const payment = await ctx.db.query.payments.findFirst({ where: eq(schema.payments.orderId, o.id), orderBy: desc(schema.payments.createdAt) });
  if (o.donorPhone !== phone && payment?.phone !== phone) throw notFound("Pedido");
  const r = await ctx.db.query.refunds.findFirst({ where: and(eq(schema.refunds.orderId, o.id), eq(schema.refunds.status, "awaiting_claim")) });
  if (!r) throw conflict("no_claimable_refund", "Não há reembolso por reclamar neste pedido.");
  if (r.claimDeadline && r.claimDeadline < ctx.now()) throw conflict("claim_expired", "O prazo para reclamar este reembolso terminou.");
  await ctx.db.update(schema.refunds).set({ status: "processing", destinationPhone: mcxPhone }).where(eq(schema.refunds.id, r.id));
  await publishOrder(ctx, o.id);
  return orderView(ctx, await getOrder(ctx, o.id));
}

async function notifyDonorRefund(ctx: Ctx, o: Order, phone: string | null, amount: number, stage: "processing" | "claim" | "done") {
  if (!phone) return;
  const text =
    stage === "done" ? `Fedha Live: o reembolso de ${amount} Kz do pedido ${o.id} foi pago.`
    : stage === "claim" ? `Fedha Live: o pedido ${o.id} vai ser reembolsado (${amount} Kz). Indica o teu Multicaixa Express em fedha.live/pedido.`
    : `Fedha Live: o pedido ${o.id} não pôde ser emitido. Vais receber ${amount} Kz de volta.`;
  await ctx.messenger.sms(phone, text).catch((err) => ctx.log.error({ err }, "sms de reembolso falhou"));
}

// ------------------------------------------------------------- expiração
export async function expireStale(ctx: Ctx) {
  const now = ctx.now();
  const stale = await ctx.db.select({ id: schema.payments.id }).from(schema.payments)
    .where(and(inArray(schema.payments.status, ["created", "pending"]), lt(schema.payments.expiresAt, now)));
  for (const p of stale) await failPayment(ctx, p.id, "expired");
  const orders = await ctx.db.select({ id: schema.orders.id }).from(schema.orders)
    .where(and(inArray(schema.orders.status, ["awaiting_payment", "payment_failed"]), lt(schema.orders.expiresAt, now)));
  for (const o of orders) {
    await ctx.db.update(schema.orders).set({ status: "expired", statusReason: "O prazo para pagar terminou." }).where(eq(schema.orders.id, o.id));
    await publishOrder(ctx, o.id);
  }
  return stale.length + orders.length;
}

/** Áudios gravados não pagos são apagados em 24 h; áudios tocados ao fim de N dias. */
export async function purgeAudio(ctx: Ctx, retentionDays: number) {
  const now = ctx.now();
  const unpaid = await ctx.db.select().from(schema.audioUploads).where(and(isNull(schema.audioUploads.deletedAt), lt(schema.audioUploads.expiresAt, now)));
  for (const a of unpaid) {
    const o = a.orderId ? await ctx.db.query.orders.findFirst({ where: eq(schema.orders.id, a.orderId) }) : null;
    if (o && ["queued", "playing", "played", "refund_pending"].includes(o.status)) continue;
    await ctx.storage.delete(a.storageKey);
    await ctx.db.update(schema.audioUploads).set({ deletedAt: now }).where(eq(schema.audioUploads.id, a.id));
  }
  const old = await ctx.db.select().from(schema.orders)
    .where(and(eq(schema.orders.status, "played"), lt(schema.orders.playedAt, new Date(now.getTime() - retentionDays * 86400_000))));
  for (const o of old) if (o.audioKey) {
    await ctx.storage.delete(o.audioKey);
    await ctx.db.update(schema.orders).set({ audioKey: null }).where(eq(schema.orders.id, o.id));
  }
}

/** Mensagens pagas que não tocaram em N dias são reembolsadas. */
export async function refundUnplayed(ctx: Ctx, days: number) {
  const cutoff = new Date(ctx.now().getTime() - days * 86400_000);
  const rows = await ctx.db.select({ id: schema.orders.id }).from(schema.orders).where(and(eq(schema.orders.status, "queued"), lt(schema.orders.paidAt, cutoff)));
  for (const o of rows) await failOrder(ctx, o.id, `A mensagem não tocou em ${days} dias.`);
  return rows.length;
}

export async function getPayment(db: DbOrTx, id: string): Promise<Payment | undefined> {
  return db.query.payments.findFirst({ where: eq(schema.payments.id, id) });
}
