import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { startOfLuandaDay } from "../../../shared/money/money";
import { getSettings } from "../../admin/application/settings";
import { topDonors, receivedGross, type Streamer } from "../../streamers/application/streamers.service";
import { monthTotals, nextReleaseAt, streamerBalances } from "../../wallet/application/wallet.service";
import { ACC, balance } from "../../wallet/domain/ledger";

const PAID = ["queued", "playing", "played"];
const luandaDay = (d: Date) => new Date(d.getTime() + 3600_000).toISOString().slice(0, 10);

async function sums(ctx: Ctx, streamerId: string | null, since: Date) {
  const [r] = await ctx.db.select({
    gross: sql<string>`coalesce(sum(${schema.orders.amount}), 0)`,
    net: sql<string>`coalesce(sum(${schema.orders.netAmount}), 0)`,
    fee: sql<string>`coalesce(sum(${schema.orders.feeAmount}), 0)`,
    n: sql<string>`count(*)`,
  }).from(schema.orders).where(and(streamerId ? eq(schema.orders.streamerId, streamerId) : undefined, inArray(schema.orders.status, PAID), gte(schema.orders.paidAt, since)));
  return { gross: Number(r!.gross), net: Number(r!.net), fee: Number(r!.fee), n: Number(r!.n) };
}

async function chart(ctx: Ctx, streamerId: string | null, days: number) {
  const since = startOfLuandaDay(new Date(ctx.now().getTime() - (days - 1) * 86400_000));
  const rows = await ctx.db.select({ paidAt: schema.orders.paidAt, amount: schema.orders.amount, net: schema.orders.netAmount })
    .from(schema.orders).where(and(streamerId ? eq(schema.orders.streamerId, streamerId) : undefined, inArray(schema.orders.status, PAID), gte(schema.orders.paidAt, since)));
  const out = new Map<string, { day: string; gross: number; net: number; count: number }>();
  for (let i = 0; i < days; i++) {
    const d = luandaDay(new Date(since.getTime() + i * 86400_000 + 3600_000));
    out.set(d, { day: d, gross: 0, net: 0, count: 0 });
  }
  for (const r of rows) {
    const b = out.get(luandaDay(r.paidAt!));
    if (b) { b.gross += r.amount; b.net += r.net; b.count++; }
  }
  return [...out.values()];
}

/** S1 — dashboard do streamer. */
export async function streamerDashboard(ctx: Ctx, s: Streamer, range: "7d" | "14d" | "30d" | "90d") {
  const now = ctx.now();
  const settings = await getSettings(ctx);
  const today = startOfLuandaDay(now);
  const week = new Date(today.getTime() - 6 * 86400_000);
  const month = new Date(today.getTime() - 29 * 86400_000);
  const [t, w, m, bal] = await Promise.all([sums(ctx, s.id, today), sums(ctx, s.id, week), sums(ctx, s.id, month), streamerBalances(ctx.db, s.id)]);
  const latestRows = await ctx.db.select().from(schema.orders).where(and(eq(schema.orders.streamerId, s.id), inArray(schema.orders.status, [...PAID, "refunded", "refund_pending", "failed"]))).orderBy(desc(schema.orders.paidAt)).limit(8);
  const alerts: { kind: string; message: string }[] = [];
  if (s.kycStatus !== "approved") {
    const got = await receivedGross(ctx, s.id);
    alerts.push({ kind: "kyc", message: s.kycStatus === "pending" ? "A tua verificação está em análise." : `Conclui a verificação para levantar. Recebeste ${got} Kz de ${settings.kycUnverifiedLimit} Kz permitidos sem KYC.` });
  }
  const lastPaid = await ctx.db.query.withdrawals.findFirst({ where: and(eq(schema.withdrawals.streamerId, s.id), eq(schema.withdrawals.status, "paid")), orderBy: desc(schema.withdrawals.paidAt) });
  if (lastPaid?.paidAt && now.getTime() - lastPaid.paidAt.getTime() < 3 * 86400_000) alerts.push({ kind: "withdrawal", message: `Levantamento ${lastPaid.id} pago.` });
  const outs = ctx.hub.outputsOf(s.id);
  return {
    balances: { available: bal.available, pending: bal.pending, nextReleaseAt: (await nextReleaseAt(ctx, s.id, settings.retentionHours))?.toISOString() ?? null },
    revenue: { today: t.net, week: w.net, month: m.net, monthGross: m.gross, monthFee: m.fee },
    messages: { today: t.n, month: m.n, avgTicket: m.n ? Math.round(m.gross / m.n) : 0 },
    chart: await chart(ctx, s.id, Number(range.replace("d", ""))),
    topDonors: await topDonors(ctx, s.id, month, 5),
    latest: latestRows.map((o) => ({ id: o.id, donorName: o.donorName, text: o.kind === "text" ? o.text : null, amount: o.amount, status: o.status as "played", at: (o.paidAt ?? o.createdAt).toISOString() })),
    outputs: { overlay: outs.some((c) => c.kind === "overlay" || c.kind === "combined"), player: outs.some((c) => c.kind === "player") },
    alerts,
  };
}

/** B1 — visão geral da plataforma. */
export async function platformOverview(ctx: Ctx) {
  const now = ctx.now();
  const today = startOfLuandaDay(now);
  const month = new Date(today.getTime() - 29 * 86400_000);
  const [t, m] = await Promise.all([sums(ctx, null, today), sums(ctx, null, month)]);
  const methods = await ctx.db.select({ method: schema.payments.method, status: schema.payments.status, n: sql<string>`count(*)` })
    .from(schema.payments).where(gte(schema.payments.createdAt, month)).groupBy(schema.payments.method, schema.payments.status);
  const byMethod: Record<string, { total: number; confirmed: number; rate: number }> = {};
  for (const r of methods) {
    const b = (byMethod[r.method] ??= { total: 0, confirmed: 0, rate: 0 });
    if (["created"].includes(r.status)) continue;
    b.total += Number(r.n);
    if (["confirmed", "refund_requested", "refunded"].includes(r.status)) b.confirmed += Number(r.n);
  }
  for (const b of Object.values(byMethod)) b.rate = b.total ? Math.round((b.confirmed / b.total) * 1000) / 10 : 0;
  const [active] = await ctx.db.select({ n: sql<string>`count(distinct ${schema.orders.streamerId})` }).from(schema.orders).where(and(inArray(schema.orders.status, PAID), gte(schema.orders.paidAt, month)));
  const [refunds] = await ctx.db.select({ n: sql<string>`count(*)`, kz: sql<string>`coalesce(sum(${schema.refunds.amount}),0)` }).from(schema.refunds).where(gte(schema.refunds.createdAt, month));
  const [alerts] = await ctx.db.select({ n: sql<string>`count(*)` }).from(schema.fraudAlerts).where(eq(schema.fraudAlerts.status, "open"));
  const [wd] = await ctx.db.select({ n: sql<string>`count(*)`, kz: sql<string>`coalesce(sum(${schema.withdrawals.amount}),0)` }).from(schema.withdrawals).where(inArray(schema.withdrawals.status, ["requested", "in_review", "approved", "paying"]));
  const [kyc] = await ctx.db.select({ n: sql<string>`count(*)` }).from(schema.kycSubmissions).where(eq(schema.kycSubmissions.status, "pending"));
  return {
    revenue: { today: t.fee, month: m.fee, total: await balance(ctx.db, ACC.revenue) },
    gmv: { today: t.gross, month: m.gross },
    messages: { today: t.n, month: m.n },
    chart: await chart(ctx, null, 30),
    activeStreamers: Number(active!.n),
    paymentSuccessByMethod: byMethod,
    refunds: { month: Number(refunds!.n), monthKz: Number(refunds!.kz) },
    openFraudAlerts: Number(alerts!.n),
    pendingWithdrawals: { count: Number(wd!.n), kz: Number(wd!.kz) },
    pendingKyc: Number(kyc!.n),
  };
}

export { monthTotals };
