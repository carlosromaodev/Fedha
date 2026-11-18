import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { forbidden, notFound } from "../../../shared/errors/app-error";
import { uuid } from "../../../shared/security/ids";
import { audit } from "../../../shared/audit/audit";
import { getSettings } from "../../admin/application/settings";
import { blockDonor } from "../../filters/application/filters.service";

/** RN-FRA-02: o streamer não pode pagar mensagens para a própria página. Bloqueia e sinaliza. */
export async function assertNotSelfPayment(ctx: Ctx, streamerId: string, phone: string | null | undefined, orderId?: string) {
  if (!phone) return;
  const s = await ctx.db.query.streamers.findFirst({ where: eq(schema.streamers.id, streamerId) });
  const owner = s ? await ctx.db.query.users.findFirst({ where: eq(schema.users.id, s.userId) }) : null;
  if (owner?.phone !== phone) return;
  await raise(ctx, { kind: "self_donation", severity: "high", streamerId, donorPhone: phone, orderId });
  throw forbidden("Não podes enviar mensagens pagas para a tua própria página.", "self_payment");
}

async function raise(ctx: Ctx, a: { kind: string; severity: "low" | "medium" | "high"; streamerId?: string; donorPhone?: string | null; orderId?: string; data?: Record<string, unknown> }) {
  // Evita repetir o mesmo alerta aberto para o mesmo par.
  const open = await ctx.db.query.fraudAlerts.findFirst({ where: and(
    eq(schema.fraudAlerts.kind, a.kind), eq(schema.fraudAlerts.status, "open"),
    a.streamerId ? eq(schema.fraudAlerts.streamerId, a.streamerId) : undefined,
    a.donorPhone ? eq(schema.fraudAlerts.donorPhone, a.donorPhone) : undefined,
  ) });
  if (open && a.kind !== "atypical_amount") return;
  await ctx.db.insert(schema.fraudAlerts).values({ id: uuid(), kind: a.kind, severity: a.severity, streamerId: a.streamerId ?? null, donorPhone: a.donorPhone ?? null, orderId: a.orderId ?? null, data: a.data ?? null, createdAt: ctx.now() });
}

/** B7 — verificações depois de cada pagamento confirmado. */
export async function checkPaidOrder(ctx: Ctx, orderId: string) {
  const o = await ctx.db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!o) return;
  const settings = await getSettings(ctx);
  const payment = await ctx.db.query.payments.findFirst({ where: and(eq(schema.payments.orderId, o.id), eq(schema.payments.status, "confirmed")) });
  const phone = payment?.phone ?? o.donorPhone;

  if (o.amount >= settings.atypicalAmount)
    await raise(ctx, { kind: "atypical_amount", severity: "medium", streamerId: o.streamerId, donorPhone: phone, orderId: o.id, data: { amount: o.amount } });

  if (phone) {
    // Autodoação: o pagador é o próprio streamer (mesmo telemóvel da conta).
    const s = await ctx.db.query.streamers.findFirst({ where: eq(schema.streamers.id, o.streamerId) });
    const owner = s ? await ctx.db.query.users.findFirst({ where: eq(schema.users.id, s.userId) }) : null;
    if (owner?.phone === phone) await raise(ctx, { kind: "self_donation", severity: "high", streamerId: o.streamerId, donorPhone: phone, orderId: o.id });

    const since = new Date(ctx.now().getTime() - 3600_000);
    const [r] = await ctx.db.select({ n: sql<string>`count(*)` }).from(schema.payments)
      .where(and(eq(schema.payments.phone, phone), eq(schema.payments.status, "confirmed"), gte(schema.payments.confirmedAt, since)));
    if (Number(r!.n) >= settings.samePhoneHourlyAlert)
      await raise(ctx, { kind: "many_payments_same_phone", severity: "medium", donorPhone: phone, streamerId: o.streamerId, data: { lastHour: Number(r!.n) } });
  }
}

export async function listAlerts(ctx: Ctx, status?: string) {
  const rows = await ctx.db.select().from(schema.fraudAlerts).where(status ? eq(schema.fraudAlerts.status, status) : undefined).orderBy(desc(schema.fraudAlerts.createdAt)).limit(500);
  return rows.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }));
}

export async function resolveAlert(ctx: Ctx, id: string, status: "dismissed" | "confirmed", adminId: string, blockPhone = false) {
  const a = await ctx.db.query.fraudAlerts.findFirst({ where: eq(schema.fraudAlerts.id, id) });
  if (!a) throw notFound("Alerta");
  await ctx.db.update(schema.fraudAlerts).set({ status, resolvedBy: adminId }).where(eq(schema.fraudAlerts.id, id));
  if (status === "confirmed" && blockPhone && a.donorPhone) await blockDonor(ctx, null, { phone: a.donorPhone, reason: `Alerta ${a.kind}` });
  await audit(ctx, { actorId: adminId, actorType: "admin", action: `fraud.${status}`, targetType: "fraud_alert", targetId: id, data: { blockPhone } });
}

export async function globalBlocklist(ctx: Ctx) {
  const rows = await ctx.db.select().from(schema.blockedDonors).where(isNull(schema.blockedDonors.streamerId)).orderBy(desc(schema.blockedDonors.createdAt));
  return rows.map((r) => ({ id: r.id, phone: r.phone, deviceId: r.deviceId, reason: r.reason, createdAt: r.createdAt.toISOString() }));
}

/**
 * Relatório para a UIF (Lei 5/20): operações de valor elevado e alertas confirmados no período, em CSV.
 * O formato oficial de comunicação tem de ser validado com o jurista e o parceiro de pagamentos.
 */
export async function uifReport(ctx: Ctx, from: Date, to: Date) {
  const settings = await getSettings(ctx);
  const big = await ctx.db.select().from(schema.orders).where(and(
    inArray(schema.orders.status, ["queued", "playing", "played", "refunded", "refund_pending"]),
    gte(schema.orders.paidAt, from), sql`${schema.orders.paidAt} <= ${to}`, gte(schema.orders.amount, settings.atypicalAmount),
  ));
  const confirmed = await ctx.db.select().from(schema.fraudAlerts).where(and(eq(schema.fraudAlerts.status, "confirmed"), gte(schema.fraudAlerts.createdAt, from), sql`${schema.fraudAlerts.createdAt} <= ${to}`));
  const lines = ["tipo;data;pedido;streamer_id;telefone_pagador;valor_kz;motivo"];
  for (const o of big) lines.push(["operacao_valor_elevado", o.paidAt!.toISOString(), o.id, o.streamerId, o.donorPhone ?? "", o.amount, ""].join(";"));
  for (const a of confirmed) lines.push(["alerta_confirmado", a.createdAt.toISOString(), a.orderId ?? "", a.streamerId ?? "", a.donorPhone ?? "", "", a.kind].join(";"));
  return lines.join("\n") + "\n";
}
