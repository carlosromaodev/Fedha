import { and, desc, eq, gte, lt, inArray } from "drizzle-orm";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { notFound } from "../../../shared/errors/app-error";
import { uuid } from "../../../shared/security/ids";
import { audit } from "../../../shared/audit/audit";

const dayBounds = (day: string) => {
  const start = new Date(`${day}T00:00:00+01:00`);
  return { start, end: new Date(start.getTime() + 86400_000) };
};

/**
 * F7 — cruza o extrato do gateway com os pagamentos confirmados e o ledger.
 * Diferenças: pago no gateway sem pedido, pedido sem pagamento no gateway, valor diferente.
 */
export async function runReconciliation(ctx: Ctx, day: string, providerName?: string, actorId?: string) {
  const gateways = providerName ? [ctx.gateways.byName(providerName)].filter(Boolean) : ctx.gateways.all();
  const runs = [];
  for (const g of gateways) {
    const id = uuid();
    try {
      const statement = await g!.statement(day);
      const { start, end } = dayBounds(day);
      const ours = await ctx.db.select().from(schema.payments).where(and(
        eq(schema.payments.provider, g!.name), gte(schema.payments.confirmedAt, start), lt(schema.payments.confirmedAt, end),
        inArray(schema.payments.status, ["confirmed", "refund_requested", "refunded", "refund_failed"]),
      ));
      const items: (typeof schema.reconciliationItems.$inferInsert)[] = [];
      const byRef = new Map(ours.map((p) => [p.providerRef ?? "", p]));
      const seen = new Set<string>();
      for (const line of statement) {
        const p = byRef.get(line.providerRef);
        seen.add(line.providerRef);
        if (!p) items.push({ id: uuid(), runId: id, kind: "gateway_without_order", providerRef: line.providerRef, gatewayAmount: line.amount, createdAt: ctx.now() });
        else if (p.amount !== line.amount) items.push({ id: uuid(), runId: id, kind: "amount_mismatch", orderId: p.orderId, providerRef: line.providerRef, gatewayAmount: line.amount, ledgerAmount: p.amount, createdAt: ctx.now() });
      }
      for (const p of ours) if (!seen.has(p.providerRef ?? "")) items.push({ id: uuid(), runId: id, kind: "order_without_payment", orderId: p.orderId, providerRef: p.providerRef, ledgerAmount: p.amount, createdAt: ctx.now() });
      const summary = {
        statementLines: statement.length, payments: ours.length, differences: items.length,
        statementTotal: statement.reduce((s, l) => s + l.amount, 0), paymentsTotal: ours.reduce((s, p) => s + p.amount, 0),
      };
      await ctx.db.insert(schema.reconciliationRuns).values({ id, provider: g!.name, day, status: "done", summary, createdBy: actorId ?? null, createdAt: ctx.now() });
      if (items.length) await ctx.db.insert(schema.reconciliationItems).values(items);
      runs.push({ id, provider: g!.name, day, status: "done", summary });
    } catch (err) {
      ctx.log.error({ err, provider: g!.name, day }, "reconciliação falhou");
      await ctx.db.insert(schema.reconciliationRuns).values({ id, provider: g!.name, day, status: "failed", summary: {}, createdBy: actorId ?? null, createdAt: ctx.now() });
      runs.push({ id, provider: g!.name, day, status: "failed", summary: {} });
    }
  }
  if (actorId) await audit(ctx, { actorId, actorType: "admin", action: "reconciliation.run", data: { day, provider: providerName ?? "todos" } });
  return runs;
}

export async function listRuns(ctx: Ctx) {
  const rows = await ctx.db.select().from(schema.reconciliationRuns).orderBy(desc(schema.reconciliationRuns.createdAt)).limit(100);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function runItems(ctx: Ctx, runId: string) {
  const run = await ctx.db.query.reconciliationRuns.findFirst({ where: eq(schema.reconciliationRuns.id, runId) });
  if (!run) throw notFound("Reconciliação");
  const items = await ctx.db.select().from(schema.reconciliationItems).where(eq(schema.reconciliationItems.runId, runId));
  return { run: { ...run, createdAt: run.createdAt.toISOString() }, items: items.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() })) };
}

export async function openItems(ctx: Ctx) {
  const rows = await ctx.db.select().from(schema.reconciliationItems).where(eq(schema.reconciliationItems.status, "open")).orderBy(desc(schema.reconciliationItems.createdAt));
  return rows.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() }));
}

export async function resolveItem(ctx: Ctx, id: string, resolution: string, adminId: string) {
  const i = await ctx.db.query.reconciliationItems.findFirst({ where: eq(schema.reconciliationItems.id, id) });
  if (!i) throw notFound("Diferença");
  await ctx.db.update(schema.reconciliationItems).set({ status: "resolved", resolution, resolvedBy: adminId }).where(eq(schema.reconciliationItems.id, id));
  await audit(ctx, { actorId: adminId, actorType: "admin", action: "reconciliation.resolved", targetType: "reconciliation_item", targetId: id, data: { resolution } });
}

/** Dia anterior em Luanda (AAAA-MM-DD). */
export const yesterdayLuanda = (now: Date) => new Date(now.getTime() + 3600_000 - 86400_000).toISOString().slice(0, 10);
