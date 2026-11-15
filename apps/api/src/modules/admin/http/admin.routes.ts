import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import {
  AdminListQuery, AdminReplyBody, BaseWordsBody, CreateAdminBody, GlobalBlockBody, NotesBody, ReasonBody, ReportDecisionBody,
  ResolveBody, RunReconciliationBody, SetAdminRoleBody, SetFeeBody, TicketUpdateBody,
} from "@fedha/contracts";
import type { Ctx } from "../../../shared/context";
import { schema } from "../../../shared/database/client";
import { notFound } from "../../../shared/errors/app-error";
import { audit } from "../../../shared/audit/audit";
import { ipOf, requireAdmin } from "../../../shared/http/auth";
import { extForMime } from "../../../integrations/storage/storage";
import { getSettings, updateSettings } from "../application/settings";
import * as admin from "../application/admin.service";
import { platformOverview } from "../../analytics/application/analytics.service";
import * as kyc from "../../kyc/application/kyc.service";
import * as withdrawals from "../../withdrawals/application/withdrawals.service";
import * as payments from "../../payments/application/payments.service";
import * as recon from "../../reconciliation/application/reconciliation.service";
import * as fraud from "../../fraud/application/fraud.service";
import * as support from "../../support/application/support.service";
import { blockDonor, blockedWordsFor, setBaseWords } from "../../filters/application/filters.service";
import { streamerById } from "../../streamers/application/streamers.service";
import { toCsv } from "../../streamers/http/streamer.routes";

export async function adminRoutes(app: FastifyInstance, ctx: Ctx) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const P = (perm: string) => ({ preHandler: requireAdmin(ctx, perm) });
  const Id = z.object({ id: z.string() });
  const me = (req: { auth?: { user: { id: string } } }) => req.auth!.user.id;

  // ----------------------------------------------------------- B1
  r.get("/v1/admin/overview", P("overview"), async () => platformOverview(ctx));

  // ----------------------------------------------------------- B2
  r.get("/v1/admin/streamers", { ...P("streamers.read"), schema: { querystring: AdminListQuery } }, async (req) => ({ items: await admin.listStreamers(ctx, req.query.q, req.query.status) }));
  r.get("/v1/admin/streamers/:id", { ...P("streamers.read"), schema: { params: Id } }, async (req) => admin.streamerDetail(ctx, req.params.id));
  r.post("/v1/admin/streamers/:id/suspend", { ...P("streamers"), schema: { params: Id, body: ReasonBody } }, async (req) => { await admin.setStreamerStatus(ctx, req.params.id, "suspended", req.body.reason, me(req)); return { ok: true }; });
  r.post("/v1/admin/streamers/:id/reactivate", { ...P("streamers"), schema: { params: Id } }, async (req) => { await admin.setStreamerStatus(ctx, req.params.id, "active", "reativado", me(req)); return { ok: true }; });
  r.put("/v1/admin/streamers/:id/fee", { ...P("streamers"), schema: { params: Id, body: SetFeeBody } }, async (req) => { await admin.setStreamerFee(ctx, req.params.id, req.body.feePercent, me(req)); return { ok: true }; });
  r.put("/v1/admin/streamers/:id/notes", { ...P("streamers"), schema: { params: Id, body: NotesBody } }, async (req) => { await admin.setStreamerNotes(ctx, req.params.id, req.body.notes, me(req)); return { ok: true }; });

  // ----------------------------------------------------------- B3 KYC
  r.get("/v1/admin/kyc", { ...P("kyc.read"), schema: { querystring: z.object({ status: z.string().optional() }) } }, async (req) => {
    const rows = await ctx.db.select().from(schema.kycSubmissions).where(req.query.status ? eq(schema.kycSubmissions.status, req.query.status) : undefined).orderBy(desc(schema.kycSubmissions.createdAt)).limit(500);
    const items = [];
    for (const k of rows) {
      const s = await streamerById(ctx, k.streamerId);
      items.push({ id: k.id, streamerId: s.id, streamer: s.displayName, legalName: k.fullName, status: k.status, documents: Object.keys(k.documents).length, reason: k.decisionReason, createdAt: k.createdAt.toISOString(), reviewedAt: k.reviewedAt?.toISOString() ?? null });
    }
    return { items };
  });
  r.get("/v1/admin/kyc/:id", { ...P("kyc.read"), schema: { params: Id } }, async (req) => {
    const k = await ctx.db.query.kycSubmissions.findFirst({ where: eq(schema.kycSubmissions.id, req.params.id) });
    if (!k) throw notFound("Verificação");
    const history = await ctx.db.select().from(schema.auditLog).where(eq(schema.auditLog.targetId, k.id)).orderBy(desc(schema.auditLog.createdAt));
    return { ...k, documents: Object.keys(k.documents), createdAt: k.createdAt.toISOString(), history: history.map((h) => ({ action: h.action, actorId: h.actorId, data: h.data, at: h.createdAt.toISOString() })) };
  });
  r.get("/v1/admin/kyc/:id/documents/:field", { ...P("kyc.read"), schema: { params: z.object({ id: z.string(), field: z.string() }) } }, async (req, reply) => {
    const doc = await kyc.readKycDocument(ctx, req.params.id, req.params.field, me(req), ipOf(req));
    return reply.header("Content-Type", doc.mime).header("Cache-Control", "no-store").send(doc.data);
  });
  r.post("/v1/admin/kyc/:id/approve", { ...P("kyc"), schema: { params: Id } }, async (req) => { await kyc.decideKyc(ctx, req.params.id, "approved", null, me(req)); return { ok: true }; });
  r.post("/v1/admin/kyc/:id/reject", { ...P("kyc"), schema: { params: Id, body: ReasonBody } }, async (req) => { await kyc.decideKyc(ctx, req.params.id, "rejected", req.body.reason, me(req)); return { ok: true }; });
  r.post("/v1/admin/kyc/:id/request-correction", { ...P("kyc"), schema: { params: Id, body: ReasonBody } }, async (req) => { await kyc.decideKyc(ctx, req.params.id, "correction_requested", req.body.reason, me(req)); return { ok: true }; });

  // ----------------------------------------------------------- B4 transações
  r.get("/v1/admin/transactions", { ...P("transactions.read"), schema: { querystring: AdminListQuery } }, async (req) => admin.listTransactions(ctx, req.query));
  r.get("/v1/admin/transactions/:id", { ...P("transactions.read"), schema: { params: Id } }, async (req) => admin.transactionDetail(ctx, req.params.id));
  /** Reembolso manual (falha técnica confirmada pelo suporte). */
  r.post("/v1/admin/transactions/:id/refund", { ...P("transactions"), schema: { params: Id, body: ReasonBody } }, async (req) => {
    await payments.failOrder(ctx, req.params.id, req.body.reason, { id: me(req), type: "admin" });
    return admin.transactionDetail(ctx, req.params.id);
  });
  r.post("/v1/admin/transactions/:id/dispute", { ...P("transactions"), schema: { params: Id, body: z.object({ disputed: z.boolean(), reason: z.string().min(3) }) } }, async (req) => {
    await admin.setDispute(ctx, req.params.id, req.body.disputed, req.body.reason, me(req));
    return { ok: true };
  });
  r.get("/v1/admin/failures", P("transactions.read"), async () => admin.failures(ctx));
  r.post("/v1/admin/refunds/:id/mark-paid", { ...P("transactions"), schema: { params: Id, body: z.object({ providerRef: z.string().optional() }).default({}) } }, async (req) => {
    await payments.completeRefund(ctx, req.params.id, req.body.providerRef ?? null, { id: me(req) });
    return { ok: true };
  });

  // ----------------------------------------------------------- B5 reconciliação
  r.get("/v1/admin/reconciliation", P("reconciliation"), async () => ({ runs: await recon.listRuns(ctx), open: await recon.openItems(ctx) }));
  r.post("/v1/admin/reconciliation/run", { ...P("reconciliation"), schema: { body: RunReconciliationBody } }, async (req) => ({ runs: await recon.runReconciliation(ctx, req.body.day, req.body.provider, me(req)) }));
  r.get("/v1/admin/reconciliation/:id", { ...P("reconciliation"), schema: { params: Id } }, async (req) => recon.runItems(ctx, req.params.id));
  r.post("/v1/admin/reconciliation/items/:id/resolve", { ...P("reconciliation"), schema: { params: Id, body: ResolveBody } }, async (req) => { await recon.resolveItem(ctx, req.params.id, req.body.resolution, me(req)); return { ok: true }; });

  // ----------------------------------------------------------- B6 levantamentos
  r.get("/v1/admin/withdrawals", { ...P("withdrawals"), schema: { querystring: z.object({ status: z.string().optional() }) } }, async (req) =>
    ({ items: await withdrawals.adminQueue(ctx, req.query.status ? req.query.status.split(",") : ["requested", "in_review", "approved", "paying"]) }));
  r.post("/v1/admin/withdrawals/:id/approve", { ...P("withdrawals"), schema: { params: Id } }, async (req) => { await withdrawals.approve(ctx, req.params.id, me(req)); return { ok: true }; });
  r.post("/v1/admin/withdrawals/:id/reject", { ...P("withdrawals"), schema: { params: Id, body: ReasonBody } }, async (req) => { await withdrawals.reject(ctx, req.params.id, req.body.reason, me(req)); return { ok: true }; });
  r.post("/v1/admin/withdrawals/:id/fail", { ...P("withdrawals"), schema: { params: Id, body: ReasonBody } }, async (req) => { await withdrawals.reject(ctx, req.params.id, req.body.reason, me(req), "failed"); return { ok: true }; });
  /** Marcar como pago, com comprovativo opcional (multipart, campo "proof"). */
  r.post("/v1/admin/withdrawals/:id/mark-paid", { ...P("withdrawals"), schema: { params: Id } }, async (req) => {
    let proof;
    if (req.isMultipart()) {
      const f = await req.file({ limits: { fileSize: 5 * 1024 * 1024 } });
      if (f) proof = { data: await f.toBuffer(), mime: f.mimetype, ext: extForMime(f.mimetype) };
    }
    await withdrawals.markPaid(ctx, req.params.id, me(req), proof);
    return { ok: true };
  });
  r.post("/v1/admin/withdrawals/export.csv", P("withdrawals"), async (req, reply) => {
    const b = await withdrawals.exportBatch(ctx, me(req));
    return reply.header("Content-Type", "text/csv; charset=utf-8").header("Content-Disposition", `attachment; filename="${b.batchId}.csv"`).header("X-Batch-Count", String(b.count)).send(b.csv);
  });

  // ----------------------------------------------------------- B7 antifraude
  r.get("/v1/admin/fraud/alerts", { ...P("fraud"), schema: { querystring: z.object({ status: z.string().optional() }) } }, async (req) => ({ items: await fraud.listAlerts(ctx, req.query.status) }));
  r.post("/v1/admin/fraud/alerts/:id/resolve", { ...P("fraud"), schema: { params: Id, body: z.object({ status: z.enum(["dismissed", "confirmed"]), blockPhone: z.boolean().default(false) }) } }, async (req) => {
    await fraud.resolveAlert(ctx, req.params.id, req.body.status, me(req), req.body.blockPhone);
    return { ok: true };
  });
  r.get("/v1/admin/fraud/rules", P("fraud"), async () => {
    const s = await getSettings(ctx);
    return { donorDailyMaxMessages: s.donorDailyMaxMessages, donorDailyMaxAmount: s.donorDailyMaxAmount, atypicalAmount: s.atypicalAmount, samePhoneHourlyAlert: s.samePhoneHourlyAlert, kycUnverifiedLimit: s.kycUnverifiedLimit, manualReviewAbove: s.manualReviewAbove };
  });
  r.put("/v1/admin/fraud/rules", { ...P("fraud"), schema: { body: z.record(z.unknown()) } }, async (req) => {
    const allowed = ["donorDailyMaxMessages", "donorDailyMaxAmount", "atypicalAmount", "samePhoneHourlyAlert", "kycUnverifiedLimit", "manualReviewAbove"];
    const patch = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    await updateSettings(ctx, patch);
    await audit(ctx, { actorId: me(req), actorType: "admin", action: "fraud.rules_updated", data: patch });
    return { ok: true };
  });
  r.get("/v1/admin/fraud/global-blocklist", P("fraud"), async () => ({ items: await fraud.globalBlocklist(ctx) }));
  r.post("/v1/admin/fraud/global-blocklist", { ...P("fraud"), schema: { body: GlobalBlockBody } }, async (req, reply) => {
    const id = await blockDonor(ctx, null, req.body);
    await audit(ctx, { actorId: me(req), actorType: "admin", action: "fraud.global_block", data: { phone: req.body.phone, deviceId: req.body.deviceId } });
    return reply.status(201).send({ id });
  });
  r.delete("/v1/admin/fraud/global-blocklist/:id", { ...P("fraud"), schema: { params: Id } }, async (req) => {
    await ctx.db.delete(schema.blockedDonors).where(eq(schema.blockedDonors.id, req.params.id));
    await audit(ctx, { actorId: me(req), actorType: "admin", action: "fraud.global_unblock", targetId: req.params.id });
    return { ok: true };
  });
  r.get("/v1/admin/fraud/uif-report.csv", { ...P("fraud"), schema: { querystring: z.object({ from: z.string(), to: z.string() }) } }, async (req, reply) => {
    const csv = await fraud.uifReport(ctx, new Date(req.query.from), new Date(req.query.to));
    await audit(ctx, { actorId: me(req), actorType: "admin", action: "fraud.uif_report", data: req.query });
    return reply.header("Content-Type", "text/csv; charset=utf-8").header("Content-Disposition", `attachment; filename="uif-${req.query.from}-${req.query.to}.csv"`).send(csv);
  });

  // ----------------------------------------------------------- B8 moderação
  r.get("/v1/admin/moderation/base-words", P("moderation"), async () => ({ words: (await blockedWordsFor(ctx, "__none__")).base }));
  r.put("/v1/admin/moderation/base-words", { ...P("moderation"), schema: { body: BaseWordsBody } }, async (req) => {
    const words = await setBaseWords(ctx, req.body.words);
    await audit(ctx, { actorId: me(req), actorType: "admin", action: "moderation.base_words", data: { count: words.length } });
    return { words };
  });
  r.get("/v1/admin/moderation/reports", { ...P("moderation"), schema: { querystring: z.object({ status: z.string().optional() }) } }, async (req) => ({ items: await admin.listReports(ctx, req.query.status) }));
  r.post("/v1/admin/moderation/reports/:id/decide", { ...P("moderation"), schema: { params: Id, body: ReportDecisionBody } }, async (req) => {
    await admin.decideReport(ctx, req.params.id, req.body.decision, req.body.resolution, req.body.suspendDonor, me(req));
    return { ok: true };
  });
  r.post("/v1/admin/moderation/streamers/:id/remove-profile", { ...P("moderation"), schema: { params: Id, body: ReasonBody } }, async (req) => {
    await admin.setStreamerStatus(ctx, req.params.id, "removed", req.body.reason, me(req));
    return { ok: true };
  });

  // ----------------------------------------------------------- B9 configurações
  r.get("/v1/admin/settings", P("*"), async () => getSettings(ctx));
  r.put("/v1/admin/settings", { ...P("*"), schema: { body: z.record(z.unknown()) } }, async (req) => {
    const next = await updateSettings(ctx, req.body as never);
    await audit(ctx, { actorId: me(req), actorType: "admin", action: "settings.updated", data: { fields: Object.keys(req.body) } });
    return next;
  });
  r.get("/v1/admin/catalog", P("*"), async () => ({
    voices: await ctx.db.select().from(schema.voices),
    effects: await ctx.db.select().from(schema.soundEffects),
  }));
  r.put("/v1/admin/catalog/voices/:id", { ...P("*"), schema: { params: Id, body: z.object({ name: z.string(), description: z.string().default(""), premium: z.boolean(), provider: z.string().default("default"), providerVoiceId: z.string().default(""), active: z.boolean().default(true) }) } }, async (req) => {
    await ctx.db.insert(schema.voices).values({ id: req.params.id, ...req.body }).onConflictDoUpdate({ target: schema.voices.id, set: req.body });
    await audit(ctx, { actorId: me(req), actorType: "admin", action: "catalog.voice", targetId: req.params.id });
    return { ok: true };
  });
  r.put("/v1/admin/catalog/effects/:id", { ...P("*"), schema: { params: Id, body: z.object({ name: z.string(), active: z.boolean().default(true) }) } }, async (req) => {
    await ctx.db.insert(schema.soundEffects).values({ id: req.params.id, ...req.body }).onConflictDoUpdate({ target: schema.soundEffects.id, set: req.body });
    await audit(ctx, { actorId: me(req), actorType: "admin", action: "catalog.effect", targetId: req.params.id });
    return { ok: true };
  });

  // ----------------------------------------------------------- B10 suporte
  r.get("/v1/admin/support/tickets", { ...P("support"), schema: { querystring: z.object({ status: z.string().optional() }) } }, async (req) => ({ items: await support.adminList(ctx, req.query.status?.split(",")) }));
  r.get("/v1/admin/support/tickets/:id", { ...P("support"), schema: { params: Id } }, async (req) => support.ticketFor(ctx, req.params.id, null));
  r.patch("/v1/admin/support/tickets/:id", { ...P("support"), schema: { params: Id, body: TicketUpdateBody } }, async (req) => support.adminUpdate(ctx, req.params.id, req.body, me(req)));
  r.post("/v1/admin/support/tickets/:id/messages", { ...P("support"), schema: { params: Id, body: AdminReplyBody } }, async (req) => support.reply(ctx, req.params.id, { id: me(req), type: "admin" }, req.body.body, req.body.internal));

  // ----------------------------------------------------------- B11 administradores e auditoria
  r.get("/v1/admin/admins", P("*"), async () => ({ items: await admin.listAdmins(ctx) }));
  r.post("/v1/admin/admins", { ...P("*"), schema: { body: CreateAdminBody } }, async (req, reply) => reply.status(201).send({ id: await admin.createAdmin(ctx, req.body, me(req)) }));
  r.put("/v1/admin/admins/:id/role", { ...P("*"), schema: { params: Id, body: SetAdminRoleBody } }, async (req) => { await admin.setAdminRole(ctx, req.params.id, req.body.adminRole, me(req)); return { ok: true }; });
  r.post("/v1/admin/admins/:id/suspend", { ...P("*"), schema: { params: Id } }, async (req) => { await admin.setAdminStatus(ctx, req.params.id, "suspended", me(req)); return { ok: true }; });
  r.post("/v1/admin/admins/:id/reactivate", { ...P("*"), schema: { params: Id } }, async (req) => { await admin.setAdminStatus(ctx, req.params.id, "active", me(req)); return { ok: true }; });
  r.get("/v1/admin/audit", { ...P("audit"), schema: { querystring: AdminListQuery.extend({ actorId: z.string().optional(), action: z.string().optional(), targetId: z.string().optional() }) } }, async (req) => admin.auditLog(ctx, req.query));
  r.get("/v1/admin/audit/export.csv", { ...P("audit"), schema: { querystring: z.object({ from: z.string().optional(), to: z.string().optional() }) } }, async (req, reply) => {
    const { items } = await admin.auditLog(ctx, { ...req.query, page: 1, pageSize: 50000 });
    return reply.header("Content-Type", "text/csv; charset=utf-8").header("Content-Disposition", `attachment; filename="auditoria.csv"`)
      .send(toCsv([["data", "autor", "tipo", "acao", "alvo", "ip"], ...items.map((i) => [i.createdAt, i.actorId ?? "", i.actorType, i.action, `${i.targetType ?? ""}:${i.targetId ?? ""}`, i.ip ?? ""])]));
  });

}
