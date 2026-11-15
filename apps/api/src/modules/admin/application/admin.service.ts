import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { ADMIN_PERMISSIONS, type AdminRole } from "@fedha/contracts";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { conflict, forbidden, notFound } from "../../../shared/errors/app-error";
import { uuid } from "../../../shared/security/ids";
import { hashPassword } from "../../../shared/security/crypto";
import { audit } from "../../../shared/audit/audit";
import { streamerById } from "../../streamers/application/streamers.service";
import { monthTotals, streamerBalances } from "../../wallet/application/wallet.service";
import { revokeSessions } from "../../auth/application/auth.service";
import { blockDonor } from "../../filters/application/filters.service";
import { notifyStreamer } from "../../notifications/application/notifications.service";
import { maskPhone } from "../../queue/application/queue.service";

export function can(adminRole: string | null, permission: string) {
  const perms = ADMIN_PERMISSIONS[(adminRole ?? "") as AdminRole] ?? [];
  if (perms.includes("*") || perms.includes(permission)) return true;
  // "x.read" é coberto por "x"
  return permission.endsWith(".read") && perms.includes(permission.slice(0, -5));
}

export function assertCan(adminRole: string | null, permission: string) {
  if (!can(adminRole, permission)) throw forbidden("O teu papel não tem acesso a esta área.");
}

// ------------------------------------------------------------- B2 streamers
export async function listStreamers(ctx: Ctx, q?: string, status?: string) {
  const rows = await ctx.db.select({ s: schema.streamers, email: schema.users.email }).from(schema.streamers)
    .innerJoin(schema.users, eq(schema.users.id, schema.streamers.userId))
    .where(and(q ? or(ilike(schema.streamers.handle, `%${q}%`), ilike(schema.streamers.displayName, `%${q}%`), ilike(schema.users.email, `%${q}%`)) : undefined, status ? eq(schema.streamers.status, status) : undefined))
    .orderBy(desc(schema.streamers.createdAt)).limit(500);
  const since = new Date(ctx.now().getTime() - 30 * 86400_000);
  const out = [];
  for (const { s, email } of rows) {
    const [m, b] = await Promise.all([monthTotals(ctx, s.id, since), streamerBalances(ctx.db, s.id)]);
    out.push({ id: s.id, handle: s.handle, displayName: s.displayName, email, platform: s.platform, kycStatus: s.kycStatus, status: s.status, monthGross: m.gross, available: b.available, pending: b.pending, feePercent: s.feePercent, createdAt: s.createdAt.toISOString() });
  }
  return out;
}

export async function streamerDetail(ctx: Ctx, id: string) {
  const s = await streamerById(ctx, id);
  const u = await ctx.db.query.users.findFirst({ where: eq(schema.users.id, s.userId) });
  const [b, orders, wds, kyc] = await Promise.all([
    streamerBalances(ctx.db, s.id),
    ctx.db.select().from(schema.orders).where(eq(schema.orders.streamerId, s.id)).orderBy(desc(schema.orders.createdAt)).limit(50),
    ctx.db.select().from(schema.withdrawals).where(eq(schema.withdrawals.streamerId, s.id)).orderBy(desc(schema.withdrawals.createdAt)).limit(50),
    ctx.db.select().from(schema.kycSubmissions).where(eq(schema.kycSubmissions.streamerId, s.id)).orderBy(desc(schema.kycSubmissions.createdAt)),
  ]);
  return {
    streamer: { ...s, createdAt: s.createdAt.toISOString() },
    user: u ? { id: u.id, email: u.email, phone: u.phone, status: u.status, twoFactor: u.twoFactorMethod, createdAt: u.createdAt.toISOString() } : null,
    balances: b,
    orders: orders.map((o) => ({ id: o.id, createdAt: o.createdAt.toISOString(), donorName: o.donorName, amount: o.amount, status: o.status })),
    withdrawals: wds.map((w) => ({ id: w.id, amount: w.amount, status: w.status, createdAt: w.createdAt.toISOString() })),
    kyc: kyc.map((k) => ({ id: k.id, status: k.status, reason: k.decisionReason, createdAt: k.createdAt.toISOString() })),
  };
}

export async function setStreamerStatus(ctx: Ctx, id: string, status: "active" | "suspended" | "removed", reason: string, adminId: string) {
  const s = await streamerById(ctx, id);
  await ctx.db.update(schema.streamers).set({ status }).where(eq(schema.streamers.id, id));
  if (status !== "active") {
    await ctx.db.update(schema.users).set({ status: "suspended" }).where(eq(schema.users.id, s.userId));
    await revokeSessions(ctx, s.userId, {});
  } else {
    await ctx.db.update(schema.users).set({ status: "active" }).where(eq(schema.users.id, s.userId));
  }
  await audit(ctx, { actorId: adminId, actorType: "admin", action: `streamer.${status}`, targetType: "streamer", targetId: id, streamerId: id, data: { reason } });
}

export async function setStreamerFee(ctx: Ctx, id: string, feePercent: number | null, adminId: string) {
  await streamerById(ctx, id);
  await ctx.db.update(schema.streamers).set({ feePercent: feePercent === null ? null : Math.round(feePercent) }).where(eq(schema.streamers.id, id));
  await audit(ctx, { actorId: adminId, actorType: "admin", action: "streamer.fee", targetType: "streamer", targetId: id, streamerId: id, data: { feePercent } });
}

export async function setStreamerNotes(ctx: Ctx, id: string, notes: string, adminId: string) {
  await ctx.db.update(schema.streamers).set({ internalNotes: notes }).where(eq(schema.streamers.id, id));
  await audit(ctx, { actorId: adminId, actorType: "admin", action: "streamer.notes", targetType: "streamer", targetId: id, streamerId: id });
}

// ------------------------------------------------------------- B4 transações
export async function listTransactions(ctx: Ctx, f: { q?: string; status?: string; method?: string; from?: string; to?: string; streamerId?: string; page: number; pageSize: number }) {
  const where = and(
    f.status ? eq(schema.orders.status, f.status) : inArray(schema.orders.status, ["awaiting_payment", "queued", "playing", "played", "expired", "payment_failed", "failed", "refund_pending", "refunded"]),
    f.streamerId ? eq(schema.orders.streamerId, f.streamerId) : undefined,
    f.from ? gte(schema.orders.createdAt, new Date(f.from)) : undefined,
    f.to ? lte(schema.orders.createdAt, new Date(f.to)) : undefined,
    f.q ? or(ilike(schema.orders.id, `%${f.q}%`), ilike(schema.orders.donorPhone, `%${f.q}%`), ilike(schema.orders.donorName, `%${f.q}%`)) : undefined,
  );
  const [count] = await ctx.db.select({ n: sql<string>`count(*)` }).from(schema.orders).where(where);
  const rows = await ctx.db.select().from(schema.orders).where(where).orderBy(desc(schema.orders.createdAt)).limit(f.pageSize).offset((f.page - 1) * f.pageSize);
  const items = [];
  for (const o of rows) {
    const p = await ctx.db.query.payments.findFirst({ where: eq(schema.payments.orderId, o.id), orderBy: desc(schema.payments.createdAt) });
    if (f.method && p?.method !== f.method) continue;
    const s = await streamerById(ctx, o.streamerId);
    items.push({ id: o.id, createdAt: o.createdAt.toISOString(), donorName: o.donorName, donorPhone: o.donorPhone, streamer: s.displayName, method: (p?.method ?? null) as "mcx" | null, amount: o.amount, orderStatus: o.status, paymentStatus: p?.status ?? null, disputed: !!p?.disputed });
  }
  return { items, total: Number(count!.n), page: f.page, pageSize: f.pageSize };
}

/** Detalhe com o payload do gateway, webhooks e movimentos do ledger. */
export async function transactionDetail(ctx: Ctx, orderId: string) {
  const o = await ctx.db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!o) throw notFound("Transação");
  const payments = await ctx.db.select().from(schema.payments).where(eq(schema.payments.orderId, o.id)).orderBy(desc(schema.payments.createdAt));
  const refs = payments.map((p) => p.id);
  const webhooks = refs.length ? (await ctx.db.select().from(schema.webhookEvents).orderBy(desc(schema.webhookEvents.createdAt)).limit(500)).filter((w) => JSON.stringify(w.payload ?? {}).match(new RegExp(refs.join("|")))) : [];
  const ledger = await ctx.db.select().from(schema.ledgerEntries).where(or(eq(schema.ledgerEntries.refId, o.id), refs.length ? inArray(schema.ledgerEntries.refId, refs) : undefined));
  const refunds = await ctx.db.select().from(schema.refunds).where(eq(schema.refunds.orderId, o.id));
  const auditRows = await ctx.db.select().from(schema.auditLog).where(eq(schema.auditLog.targetId, o.id)).orderBy(desc(schema.auditLog.createdAt));
  return { order: o, payments, webhooks, ledger, refunds, audit: auditRows };
}

export async function setDispute(ctx: Ctx, orderId: string, disputed: boolean, reason: string, adminId: string) {
  const p = await ctx.db.query.payments.findFirst({ where: and(eq(schema.payments.orderId, orderId), inArray(schema.payments.status, ["confirmed", "refund_requested", "refunded"])) });
  if (!p) throw notFound("Pagamento confirmado");
  await ctx.db.update(schema.payments).set({ disputed, updatedAt: ctx.now() }).where(eq(schema.payments.id, p.id));
  await audit(ctx, { actorId: adminId, actorType: "admin", action: disputed ? "payment.disputed" : "payment.dispute_closed", targetType: "order", targetId: orderId, data: { reason } });
}

/** Falhas: pedidos falhados e reembolsos por pagar ou por reclamar. */
export async function failures(ctx: Ctx) {
  const refunds = await ctx.db.select().from(schema.refunds).where(inArray(schema.refunds.status, ["processing", "failed", "awaiting_claim"])).orderBy(desc(schema.refunds.createdAt));
  const failedPayments = await ctx.db.select().from(schema.payments).where(inArray(schema.payments.status, ["error"])).orderBy(desc(schema.payments.createdAt)).limit(200);
  const webhookErrors = (await ctx.db.select().from(schema.webhookEvents).orderBy(desc(schema.webhookEvents.createdAt)).limit(500)).filter((w) => w.error || !w.signatureOk);
  return {
    refunds: refunds.map((r) => ({ ...r, destinationPhoneMasked: maskPhone(r.destinationPhone), createdAt: r.createdAt.toISOString() })),
    paymentErrors: failedPayments.map((p) => ({ id: p.id, orderId: p.orderId, method: p.method, provider: p.provider, reason: p.failureReason, createdAt: p.createdAt.toISOString() })),
    webhookErrors: webhookErrors.map((w) => ({ id: w.id, provider: w.provider, eventId: w.eventId, error: w.error, signatureOk: w.signatureOk, createdAt: w.createdAt.toISOString() })),
  };
}

// ------------------------------------------------------------- B8 moderação
export async function listReports(ctx: Ctx, status?: string) {
  const rows = await ctx.db.select().from(schema.contentReports).where(status ? eq(schema.contentReports.status, status) : undefined).orderBy(desc(schema.contentReports.createdAt)).limit(500);
  const out = [];
  for (const r of rows) {
    const o = await ctx.db.query.orders.findFirst({ where: eq(schema.orders.id, r.orderId) });
    out.push({ ...r, createdAt: r.createdAt.toISOString(), order: o ? { id: o.id, donorName: o.donorName, donorPhoneMasked: maskPhone(o.donorPhone), kind: o.kind, text: o.text, audioUrl: o.audioKey ? ctx.storage.publicUrl(o.audioKey) : null } : null });
  }
  return out;
}

export async function decideReport(ctx: Ctx, id: string, decision: "upheld" | "dismissed", resolution: string, suspendDonor: boolean, adminId: string) {
  const r = await ctx.db.query.contentReports.findFirst({ where: eq(schema.contentReports.id, id) });
  if (!r) throw notFound("Denúncia");
  if (r.status !== "open") throw conflict("already_decided", "Esta denúncia já foi analisada.");
  await ctx.db.update(schema.contentReports).set({ status: decision, resolution, reviewedBy: adminId }).where(eq(schema.contentReports.id, id));
  if (decision === "upheld" && suspendDonor) {
    const o = await ctx.db.query.orders.findFirst({ where: eq(schema.orders.id, r.orderId) });
    if (o?.donorPhone || o?.deviceId) await blockDonor(ctx, null, { phone: o.donorPhone, deviceId: o.deviceId, reason: `Denúncia ${id}: ${resolution}` });
  }
  await audit(ctx, { actorId: adminId, actorType: "admin", action: `moderation.${decision}`, targetType: "content_report", targetId: id, streamerId: r.streamerId, data: { suspendDonor } });
  await notifyStreamer(ctx, r.streamerId, "report_reviewed", "Denúncia analisada", decision === "upheld" ? `Demos-te razão. ${resolution}` : `Não encontrámos infração. ${resolution}`);
}

// ------------------------------------------------------------- B11 administradores
export async function listAdmins(ctx: Ctx) {
  const rows = await ctx.db.select().from(schema.users).where(eq(schema.users.role, "admin"));
  return rows.map((u) => ({ id: u.id, displayName: u.displayName, email: u.email, adminRole: u.adminRole, status: u.status, twoFactor: u.twoFactorMethod, createdAt: u.createdAt.toISOString() }));
}

export async function createAdmin(ctx: Ctx, input: { displayName: string; email: string; password: string; adminRole: string }, actorId: string) {
  if (await ctx.db.query.users.findFirst({ where: eq(schema.users.email, input.email) })) throw conflict("email_taken", "Já existe uma conta com este email.");
  const id = uuid();
  await ctx.db.insert(schema.users).values({ id, role: "admin", adminRole: input.adminRole, displayName: input.displayName, email: input.email, passwordHash: await hashPassword(input.password), emailVerifiedAt: ctx.now(), createdAt: ctx.now(), updatedAt: ctx.now() });
  await audit(ctx, { actorId, actorType: "admin", action: "admin.created", targetType: "user", targetId: id, data: { adminRole: input.adminRole } });
  return id;
}

export async function setAdminRole(ctx: Ctx, id: string, adminRole: string, actorId: string) {
  if (id === actorId) throw conflict("self_change", "Não podes mudar o teu próprio papel.");
  await ctx.db.update(schema.users).set({ adminRole }).where(and(eq(schema.users.id, id), eq(schema.users.role, "admin")));
  await audit(ctx, { actorId, actorType: "admin", action: "admin.role_changed", targetType: "user", targetId: id, data: { adminRole } });
}

export async function setAdminStatus(ctx: Ctx, id: string, status: "active" | "suspended", actorId: string) {
  if (id === actorId) throw conflict("self_change", "Não podes suspender a tua própria conta.");
  await ctx.db.update(schema.users).set({ status }).where(and(eq(schema.users.id, id), eq(schema.users.role, "admin")));
  if (status === "suspended") await revokeSessions(ctx, id, {});
  await audit(ctx, { actorId, actorType: "admin", action: `admin.${status}`, targetType: "user", targetId: id });
}

export async function auditLog(ctx: Ctx, f: { actorId?: string; action?: string; targetId?: string; from?: string; to?: string; page: number; pageSize: number }) {
  const where = and(
    f.actorId ? eq(schema.auditLog.actorId, f.actorId) : undefined,
    f.action ? ilike(schema.auditLog.action, `${f.action}%`) : undefined,
    f.targetId ? eq(schema.auditLog.targetId, f.targetId) : undefined,
    f.from ? gte(schema.auditLog.createdAt, new Date(f.from)) : undefined,
    f.to ? lte(schema.auditLog.createdAt, new Date(f.to)) : undefined,
  );
  const [c] = await ctx.db.select({ n: sql<string>`count(*)` }).from(schema.auditLog).where(where);
  const rows = await ctx.db.select().from(schema.auditLog).where(where).orderBy(desc(schema.auditLog.createdAt)).limit(f.pageSize).offset((f.page - 1) * f.pageSize);
  return { items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })), total: Number(c!.n), page: f.page, pageSize: f.pageSize };
}
