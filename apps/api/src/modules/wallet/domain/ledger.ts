import { and, eq, inArray, sql } from "drizzle-orm";
import { schema, type DbOrTx } from "../../../shared/database/client";
import { uuid } from "../../../shared/security/ids";

/**
 * Ledger de dupla entrada, imutável. Cada transação tem linhas cuja soma é 0.
 * Convenção: valor positivo = crédito (aumenta o saldo de uma conta de passivo/receita),
 * negativo = débito. Os saldos são sempre calculados a partir das linhas, nunca editados.
 *
 * Contas:
 * - platform:gateway             dinheiro recebido nos gateways (ativo, fica negativo)
 * - platform:revenue             comissões e taxas da plataforma
 * - platform:refunds_payable     reembolsos devidos a doadores
 * - platform:withdrawals_payable levantamentos aprovados por pagar
 * - streamer:<id>:pending        saldo pendente (retenção)
 * - streamer:<id>:available      saldo disponível
 */
export const ACC = {
  gateway: "platform:gateway",
  revenue: "platform:revenue",
  refundsPayable: "platform:refunds_payable",
  withdrawalsPayable: "platform:withdrawals_payable",
  pending: (streamerId: string) => `streamer:${streamerId}:pending`,
  available: (streamerId: string) => `streamer:${streamerId}:available`,
};

export interface LedgerLine {
  account: string;
  amount: number;
}

export interface PostInput {
  kind: string;
  lines: LedgerLine[];
  refType?: string;
  refId?: string;
  memo?: string;
  /** Torna a operação idempotente: repetir com a mesma chave não cria nada. */
  idempotencyKey?: string;
  at: Date;
}

export async function post(db: DbOrTx, input: PostInput): Promise<string | null> {
  const lines = input.lines.filter((l) => l.amount !== 0);
  const sum = lines.reduce((s, l) => s + l.amount, 0);
  if (sum !== 0) throw new Error(`Transação desequilibrada (${sum})`);
  if (lines.some((l) => !Number.isInteger(l.amount))) throw new Error("Valores do ledger têm de ser inteiros");
  if (input.idempotencyKey) {
    const exists = await db.query.ledgerEntries.findFirst({ where: eq(schema.ledgerEntries.idempotencyKey, input.idempotencyKey) });
    if (exists) return null;
  }
  const txId = uuid();
  if (lines.length === 0) return txId;
  await db.insert(schema.ledgerEntries).values(
    lines.map((l) => ({
      id: uuid(),
      txId,
      account: l.account,
      amount: l.amount,
      kind: input.kind,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      memo: input.memo ?? "",
      idempotencyKey: input.idempotencyKey ?? null,
      createdAt: input.at,
    })),
  );
  return txId;
}

export async function balance(db: DbOrTx, account: string): Promise<number> {
  const [r] = await db
    .select({ s: sql<string>`coalesce(sum(${schema.ledgerEntries.amount}), 0)` })
    .from(schema.ledgerEntries)
    .where(eq(schema.ledgerEntries.account, account));
  return Number(r?.s ?? 0);
}

export async function balances(db: DbOrTx, accounts: string[]): Promise<Record<string, number>> {
  const rows = await db
    .select({ account: schema.ledgerEntries.account, s: sql<string>`coalesce(sum(${schema.ledgerEntries.amount}), 0)` })
    .from(schema.ledgerEntries)
    .where(inArray(schema.ledgerEntries.account, accounts))
    .groupBy(schema.ledgerEntries.account);
  const out: Record<string, number> = Object.fromEntries(accounts.map((a) => [a, 0]));
  for (const r of rows) out[r.account] = Number(r.s);
  return out;
}

export async function streamerBalances(db: DbOrTx, streamerId: string) {
  const b = await balances(db, [ACC.pending(streamerId), ACC.available(streamerId)]);
  return { pending: b[ACC.pending(streamerId)]!, available: b[ACC.available(streamerId)]! };
}

/** Ainda existe saldo pendente deste pedido por libertar? */
export async function hasEntry(db: DbOrTx, kind: string, refId: string) {
  return !!(await db.query.ledgerEntries.findFirst({ where: and(eq(schema.ledgerEntries.kind, kind), eq(schema.ledgerEntries.refId, refId)) }));
}
