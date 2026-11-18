import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { schema, type DbOrTx } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { ACC, post, streamerBalances } from "../domain/ledger";

type Order = typeof schema.orders.$inferSelect;

// ------------------------------------------------------------- movimentos
/** Pagamento confirmado: líquido entra como pendente, comissão para a plataforma. */
export const creditOrder = (db: DbOrTx, o: Order, at: Date) =>
  post(db, {
    kind: "message_credit", refType: "order", refId: o.id, at, idempotencyKey: `pay:${o.id}`,
    memo: `${o.donorName} · ${o.kind === "text" ? "texto" : "áudio"}`,
    lines: [
      { account: ACC.gateway, amount: -o.amount },
      { account: ACC.pending(o.streamerId), amount: o.netAmount },
      { account: ACC.revenue, amount: o.feeAmount },
    ],
  });

/** Passa de pendente a disponível (mensagem tocada e retenção cumprida). */
export const releaseOrder = (db: DbOrTx, o: Order, at: Date) =>
  post(db, {
    kind: "release", refType: "order", refId: o.id, at, idempotencyKey: `release:${o.id}`, memo: "Libertado após retenção",
    lines: [
      { account: ACC.pending(o.streamerId), amount: -o.netAmount },
      { account: ACC.available(o.streamerId), amount: o.netAmount },
    ],
  });

/** Reembolso por falha técnica: anula a receita do streamer e a comissão; o valor fica devido ao doador. */
export const reverseOrder = (db: DbOrTx, o: Order, at: Date, released: boolean) =>
  post(db, {
    kind: "refund", refType: "order", refId: o.id, at, idempotencyKey: `refund:${o.id}`, memo: "Reembolso por falha técnica",
    lines: [
      { account: released ? ACC.available(o.streamerId) : ACC.pending(o.streamerId), amount: -o.netAmount },
      { account: ACC.revenue, amount: -o.feeAmount },
      { account: ACC.refundsPayable, amount: o.amount },
    ],
  });

/** Pagamento que não gerou receita (duplicado ou fora de prazo): entra e fica logo devido ao doador. */
export const receiveForRefund = (db: DbOrTx, paymentId: string, amount: number, at: Date) =>
  post(db, {
    kind: "refund", refType: "payment", refId: paymentId, at, idempotencyKey: `refund-only:${paymentId}`, memo: "Pagamento a devolver",
    lines: [
      { account: ACC.gateway, amount: -amount },
      { account: ACC.refundsPayable, amount },
    ],
  });

export const refundPaidOut = (db: DbOrTx, refundId: string, amount: number, at: Date) =>
  post(db, {
    kind: "refund_payout", refType: "refund", refId: refundId, at, idempotencyKey: `refund-paid:${refundId}`,
    lines: [
      { account: ACC.refundsPayable, amount: -amount },
      { account: ACC.gateway, amount },
    ],
  });

export const debitWithdrawal = (db: DbOrTx, w: { id: string; streamerId: string; amount: number; fee: number }, at: Date) =>
  post(db, {
    kind: "withdrawal", refType: "withdrawal", refId: w.id, at, idempotencyKey: `wd:${w.id}`, memo: `Levantamento ${w.id}`,
    lines: [
      { account: ACC.available(w.streamerId), amount: -(w.amount + w.fee) },
      { account: ACC.withdrawalsPayable, amount: w.amount },
      { account: ACC.revenue, amount: w.fee },
    ],
  });

export const reverseWithdrawal = (db: DbOrTx, w: { id: string; streamerId: string; amount: number; fee: number }, at: Date) =>
  post(db, {
    kind: "withdrawal_reversal", refType: "withdrawal", refId: w.id, at, idempotencyKey: `wd-rev:${w.id}`, memo: `Levantamento ${w.id} devolvido`,
    lines: [
      { account: ACC.available(w.streamerId), amount: w.amount + w.fee },
      { account: ACC.withdrawalsPayable, amount: -w.amount },
      { account: ACC.revenue, amount: -w.fee },
    ],
  });

export const payWithdrawal = (db: DbOrTx, w: { id: string; amount: number }, at: Date) =>
  post(db, {
    kind: "withdrawal_payout", refType: "withdrawal", refId: w.id, at, idempotencyKey: `wd-paid:${w.id}`,
    lines: [
      { account: ACC.withdrawalsPayable, amount: -w.amount },
      { account: ACC.gateway, amount: w.amount },
    ],
  });

// ------------------------------------------------------------- retenção
/**
 * Liberta o saldo das mensagens tocadas cuja retenção já passou (48 h; 7 dias para cartão).
 * Chamado pela tarefa periódica.
 */
export async function releaseDue(ctx: Ctx, retentionHours: number, cardRetentionHours: number) {
  const now = ctx.now();
  const cutoff = new Date(now.getTime() - Math.min(retentionHours, cardRetentionHours) * 3600_000);
  const due = await ctx.db
    .select({ o: schema.orders, method: schema.payments.method })
    .from(schema.orders)
    .innerJoin(schema.payments, and(eq(schema.payments.orderId, schema.orders.id), inArray(schema.payments.status, ["confirmed"])))
    .where(and(eq(schema.orders.status, "played"), isNull(schema.orders.releasedAt), isNotNull(schema.orders.paidAt), lte(schema.orders.paidAt, cutoff)))
    .limit(500);
  let released = 0;
  for (const { o, method } of due) {
    const hours = method === "card" ? cardRetentionHours : retentionHours;
    if (o.paidAt!.getTime() + hours * 3600_000 > now.getTime()) continue;
    await ctx.db.transaction(async (tx) => {
      await releaseOrder(tx, o, now);
      await tx.update(schema.orders).set({ releasedAt: now }).where(eq(schema.orders.id, o.id));
    });
    released++;
  }
  return released;
}

/** Próxima libertação prevista (para "passa a disponível em …"). */
export async function nextReleaseAt(ctx: Ctx, streamerId: string, retentionHours: number): Promise<Date | null> {
  const [r] = await ctx.db
    .select({ paidAt: schema.orders.paidAt })
    .from(schema.orders)
    .where(and(eq(schema.orders.streamerId, streamerId), isNull(schema.orders.releasedAt), inArray(schema.orders.status, ["queued", "playing", "played"])))
    .orderBy(asc(schema.orders.paidAt))
    .limit(1);
  return r?.paidAt ? new Date(r.paidAt.getTime() + retentionHours * 3600_000) : null;
}

// ------------------------------------------------------------- consultas
export { streamerBalances };

export async function monthTotals(ctx: Ctx, streamerId: string, since: Date) {
  const [r] = await ctx.db
    .select({
      gross: sql<string>`coalesce(sum(${schema.orders.amount}), 0)`,
      fee: sql<string>`coalesce(sum(${schema.orders.feeAmount}), 0)`,
      net: sql<string>`coalesce(sum(${schema.orders.netAmount}), 0)`,
    })
    .from(schema.orders)
    .where(and(eq(schema.orders.streamerId, streamerId), inArray(schema.orders.status, ["queued", "playing", "played"]), gte(schema.orders.paidAt, since)));
  return { gross: Number(r!.gross), fee: Number(r!.fee), net: Number(r!.net) };
}

const KIND_LABEL: Record<string, string> = {
  message_credit: "Crédito de mensagem",
  release: "Libertação de saldo",
  refund: "Reembolso",
  withdrawal: "Levantamento",
  withdrawal_reversal: "Levantamento devolvido",
  adjustment: "Ajuste",
};

/** S12 — movimentos das contas do streamer com saldo (pendente + disponível) após cada movimento. */
export async function ledgerRows(ctx: Ctx, streamerId: string, opts: { from?: Date; to?: Date; page: number; pageSize: number }) {
  const accounts = [ACC.pending(streamerId), ACC.available(streamerId)];
  const all = await ctx.db
    .select()
    .from(schema.ledgerEntries)
    .where(inArray(schema.ledgerEntries.account, accounts))
    .orderBy(asc(schema.ledgerEntries.createdAt), asc(schema.ledgerEntries.id));
  let running = 0;
  const withBalance = all.map((e) => {
    running += e.amount;
    return {
      id: e.id,
      at: e.createdAt.toISOString(),
      kind: e.kind,
      label: `${KIND_LABEL[e.kind] ?? e.kind}${e.memo ? ` · ${e.memo}` : ""}`,
      account: e.account.endsWith(":pending") ? ("pending" as const) : ("available" as const),
      amount: e.amount,
      balanceAfter: running,
      refId: e.refId,
    };
  });
  const filtered = withBalance
    .filter((r) => (!opts.from || new Date(r.at) >= opts.from) && (!opts.to || new Date(r.at) <= opts.to))
    .reverse();
  const start = (opts.page - 1) * opts.pageSize;
  return { items: filtered.slice(start, start + opts.pageSize), total: filtered.length, page: opts.page, pageSize: opts.pageSize };
}

export async function recentEntries(ctx: Ctx, limit = 50) {
  return ctx.db.select().from(schema.ledgerEntries).orderBy(desc(schema.ledgerEntries.createdAt)).limit(limit);
}
