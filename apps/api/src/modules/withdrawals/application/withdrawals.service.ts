import { and, desc, eq, inArray } from "drizzle-orm";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { conflict, notFound, unprocessable } from "../../../shared/errors/app-error";
import { withdrawalId, uuid } from "../../../shared/security/ids";
import { audit } from "../../../shared/audit/audit";
import { formatKz } from "../../../shared/money/money";
import { getSettings } from "../../admin/application/settings";
import { streamerById, type Streamer } from "../../streamers/application/streamers.service";
import { bankAccountOf } from "../../kyc/application/kyc.service";
import { debitWithdrawal, payWithdrawal, reverseWithdrawal, streamerBalances } from "../../wallet/application/wallet.service";
import { userById, verifySecondFactor } from "../../auth/application/auth.service";
import { notifyStreamer } from "../../notifications/application/notifications.service";

type Withdrawal = typeof schema.withdrawals.$inferSelect;

export function withdrawalView(ctx: Ctx, w: Withdrawal) {
  return {
    id: w.id, amount: w.amount, fee: w.fee, total: w.amount + w.fee, destinationType: w.destinationType as "iban" | "mcx", destinationLabel: w.destinationLabel,
    status: w.status as "requested" | "in_review" | "approved" | "paying" | "paid" | "rejected" | "failed", rejectReason: w.rejectReason,
    createdAt: w.createdAt.toISOString(), paidAt: w.paidAt?.toISOString() ?? null, proofUrl: w.proofKey ? ctx.storage.publicUrl(w.proofKey) : null,
  };
}

/** Bloqueios que impedem levantar (KYC, 2FA, IBAN em verificação, suspensão). */
export async function blockers(ctx: Ctx, s: Streamer) {
  const u = await userById(ctx, s.userId);
  const out: string[] = [];
  if (s.status !== "active") out.push("A conta está suspensa.");
  if (s.kycStatus !== "approved") out.push("Conclui a verificação de identidade (KYC).");
  if (!u.twoFactorMethod) out.push("Ativa a verificação em dois passos (2FA).");
  const bank = await bankAccountOf(ctx, s.id);
  if (bank?.withdrawalsLockedUntil && bank.withdrawalsLockedUntil > ctx.now())
    out.push("Alteraste o IBAN há pouco: os levantamentos ficam bloqueados durante 48 h.");
  return out;
}

export async function quote(ctx: Ctx, s: Streamer, amount: number) {
  const settings = await getSettings(ctx);
  const { available } = await streamerBalances(ctx.db, s.id);
  const fee = settings.withdrawalFee;
  const problems = await blockers(ctx, s);
  if (amount < settings.withdrawalMin) problems.push(`O mínimo é ${formatKz(settings.withdrawalMin)}.`);
  if (amount + fee > available) problems.push(`Saldo disponível insuficiente (${formatKz(available)}, incluindo a taxa de ${formatKz(fee)}).`);
  const ageDays = (ctx.now().getTime() - s.createdAt.getTime()) / 86400_000;
  const openAlerts = await ctx.db.query.fraudAlerts.findFirst({ where: and(eq(schema.fraudAlerts.streamerId, s.id), eq(schema.fraudAlerts.status, "open")) });
  const manualReview = amount > settings.manualReviewAbove || ageDays < settings.newAccountDays || !!openAlerts;
  return { amount, fee, totalDebited: amount + fee, available, ok: problems.length === 0, problems, manualReview };
}

/** S11 / F6 — pedido → 2FA → verificações → aprovação (automática ou manual) → pagamento → comprovativo. */
export async function requestWithdrawal(ctx: Ctx, s: Streamer, input: { amount: number; destinationType: "iban" | "mcx"; twoFactorCode: string }, ip: string | null) {
  const u = await userById(ctx, s.userId);
  if (!u.twoFactorMethod) throw unprocessable("2fa_required", "Ativa a verificação em dois passos antes de levantar.");
  await verifySecondFactor(ctx, u, input.twoFactorCode, "withdrawal");
  const q = await quote(ctx, s, input.amount);
  if (!q.ok) throw unprocessable("withdrawal_invalid", q.problems[0]!, { problems: q.problems });

  let destination: Record<string, string>;
  let label: string;
  if (input.destinationType === "iban") {
    const bank = await bankAccountOf(ctx, s.id);
    if (!bank) throw unprocessable("no_bank_account", "Não tens um IBAN verificado.");
    destination = { iban: bank.iban, bankName: bank.bankName, holder: bank.holderName };
    label = `IBAN · ${bank.bankName} ••• ${bank.iban.slice(-4)}`;
  } else {
    if (!u.phone || !u.phoneVerifiedAt) throw unprocessable("phone_unverified", "Verifica o teu telemóvel para levantar por Multicaixa Express.");
    destination = { phone: u.phone };
    label = `Multicaixa Express ••• ${u.phone.slice(-3)}`;
  }
  const id = withdrawalId();
  const now = ctx.now();
  const status = q.manualReview ? "in_review" : "approved";
  await ctx.db.transaction(async (tx) => {
    await tx.insert(schema.withdrawals).values({
      id, streamerId: s.id, amount: input.amount, fee: q.fee, destinationType: input.destinationType, destinationLabel: label, destination,
      status, manualReview: q.manualReview, riskLevel: q.manualReview ? "médio" : "baixo", createdAt: now, approvedAt: status === "approved" ? now : null,
    });
    await debitWithdrawal(tx, { id, streamerId: s.id, amount: input.amount, fee: q.fee }, now);
  });
  await audit(ctx, { actorId: u.id, actorType: "streamer", action: "withdrawal.requested", targetType: "withdrawal", targetId: id, streamerId: s.id, data: { amount: input.amount, status }, ip });
  ctx.bus.emit("withdrawal.updated", { withdrawalId: id, streamerId: s.id, status });
  return withdrawalView(ctx, (await ctx.db.query.withdrawals.findFirst({ where: eq(schema.withdrawals.id, id) }))!);
}

export async function listWithdrawals(ctx: Ctx, streamerId: string) {
  const rows = await ctx.db.select().from(schema.withdrawals).where(eq(schema.withdrawals.streamerId, streamerId)).orderBy(desc(schema.withdrawals.createdAt));
  return rows.map((w) => withdrawalView(ctx, w));
}

async function get(ctx: Ctx, id: string) {
  const w = await ctx.db.query.withdrawals.findFirst({ where: eq(schema.withdrawals.id, id) });
  if (!w) throw notFound("Levantamento");
  return w;
}

// ------------------------------------------------------------- B6 back-office
export async function approve(ctx: Ctx, id: string, adminId: string) {
  const w = await get(ctx, id);
  if (!["requested", "in_review"].includes(w.status)) throw conflict("invalid_state", "Este levantamento não está à espera de aprovação.");
  await ctx.db.update(schema.withdrawals).set({ status: "approved", approvedAt: ctx.now(), reviewedBy: adminId }).where(eq(schema.withdrawals.id, id));
  await audit(ctx, { actorId: adminId, actorType: "admin", action: "withdrawal.approved", targetType: "withdrawal", targetId: id, streamerId: w.streamerId });
}

export async function reject(ctx: Ctx, id: string, reason: string, adminId: string, status: "rejected" | "failed" = "rejected") {
  const w = await get(ctx, id);
  if (["paid", "rejected", "failed"].includes(w.status)) throw conflict("invalid_state", "Este levantamento já foi fechado.");
  await ctx.db.transaction(async (tx) => {
    await tx.update(schema.withdrawals).set({ status, rejectReason: reason, reviewedBy: adminId }).where(eq(schema.withdrawals.id, id));
    await reverseWithdrawal(tx, w, ctx.now());
  });
  await audit(ctx, { actorId: adminId, actorType: "admin", action: `withdrawal.${status}`, targetType: "withdrawal", targetId: id, streamerId: w.streamerId, data: { reason } });
  await notifyStreamer(ctx, w.streamerId, "withdrawal_rejected", "Levantamento não efetuado", `${formatKz(w.amount)}: ${reason} O valor voltou ao teu saldo.`);
}

export async function markPaid(ctx: Ctx, id: string, adminId: string, proof?: { data: Buffer; mime: string; ext: string }) {
  const w = await get(ctx, id);
  if (!["approved", "paying"].includes(w.status)) throw conflict("invalid_state", "Só podes marcar como pago um levantamento aprovado.");
  let proofKey: string | null = null;
  if (proof) {
    proofKey = `proofs/${w.streamerId}/${w.id}-${uuid().slice(0, 6)}.${proof.ext}`;
    await ctx.storage.put(proofKey, proof.data, proof.mime);
  }
  await ctx.db.transaction(async (tx) => {
    await tx.update(schema.withdrawals).set({ status: "paid", paidAt: ctx.now(), proofKey }).where(eq(schema.withdrawals.id, id));
    await payWithdrawal(tx, w, ctx.now());
  });
  await audit(ctx, { actorId: adminId, actorType: "admin", action: "withdrawal.paid", targetType: "withdrawal", targetId: id, streamerId: w.streamerId });
  await notifyStreamer(ctx, w.streamerId, "withdrawal_paid", "Levantamento pago", `${formatKz(w.amount)} enviados para ${w.destinationLabel}.`);
}

export async function adminQueue(ctx: Ctx, statuses: string[]) {
  const rows = await ctx.db.select().from(schema.withdrawals).where(inArray(schema.withdrawals.status, statuses)).orderBy(desc(schema.withdrawals.createdAt));
  const out = [];
  for (const w of rows) {
    const s = await streamerById(ctx, w.streamerId);
    out.push({ ...withdrawalView(ctx, w), streamer: s.displayName, streamerId: s.id, risk: w.riskLevel, manualReview: w.manualReview });
  }
  return out;
}

/** Ficheiro de pagamentos em lote (CSV) dos aprovados; passam a "em pagamento". */
export async function exportBatch(ctx: Ctx, adminId: string) {
  const rows = await ctx.db.select().from(schema.withdrawals).where(eq(schema.withdrawals.status, "approved"));
  const batchId = `LOTE-${ctx.now().toISOString().slice(0, 10)}-${uuid().slice(0, 4)}`;
  const lines = ["id;beneficiario;tipo;iban_ou_telefone;banco;valor_kz"];
  for (const w of rows) {
    const d = w.destination;
    lines.push([w.id, d.holder ?? "", w.destinationType, d.iban ?? d.phone ?? "", d.bankName ?? "", w.amount].join(";"));
  }
  if (rows.length) await ctx.db.update(schema.withdrawals).set({ status: "paying", batchId }).where(inArray(schema.withdrawals.id, rows.map((r) => r.id)));
  await audit(ctx, { actorId: adminId, actorType: "admin", action: "withdrawal.batch_exported", data: { batchId, count: rows.length } });
  return { batchId, csv: lines.join("\n") + "\n", count: rows.length };
}
