import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import {
  BlockDonorBody, CreateGoalBody, CreateTicketBody, CreateWithdrawalBody, DashboardQuery, HistoryQuery, InviteAssistantBody, LedgerQuery, MarkReadBody,
  NotificationPrefs, OnboardingBody, PlaybackSettingsBody, RefundRequestBody, ReportBody, SetLiveBody, TicketMessageBody, UpdateFiltersBody,
  Handle, UpdateProfileBody, UpdateWidgetBody, WidgetKind, WithdrawalQuoteQuery,
} from "@fedha/contracts";
import type { Ctx } from "../../../shared/context";
import { schema } from "../../../shared/database/client";
import { AppError, notFound, unprocessable } from "../../../shared/errors/app-error";
import { uuid } from "../../../shared/security/ids";
import { audit } from "../../../shared/audit/audit";
import { ipOf, requireAuth, streamerOf, user } from "../../../shared/http/auth";
import { extForMime } from "../../../integrations/storage/storage";
import { getSettings } from "../../admin/application/settings";
import * as streamers from "../application/streamers.service";
import { getPricing, updatePricing } from "../../pricing/application/pricing.service";
import { blockDonor, blockedWordsFor, setStreamerWords } from "../../filters/application/filters.service";
import { publishSnapshot, snapshot, tagsOf, maskPhone } from "../../queue/application/queue.service";
import * as playback from "../../playback/application/playback.service";
import * as widgets from "../../playback/application/widgets.service";
import * as goals from "../../goals/application/goals.service";
import * as wallet from "../../wallet/application/wallet.service";
import * as withdrawals from "../../withdrawals/application/withdrawals.service";
import * as kyc from "../../kyc/application/kyc.service";
import * as assistants from "../../assistants/application/assistants.service";
import * as notifications from "../../notifications/application/notifications.service";
import * as support from "../../support/application/support.service";
import { streamerDashboard } from "../../analytics/application/analytics.service";

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\n") + "\n";

export async function streamerRoutes(app: FastifyInstance, ctx: Ctx) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const S = { preHandler: requireAuth(ctx, ["streamer"]) };
  const Id = z.object({ id: z.string() });
  const actor = (id: string) => ({ id, type: "streamer" as const });

  // ----------------------------------------------------------- S1
  r.get("/v1/streamer/dashboard", { ...S, schema: { querystring: DashboardQuery } }, async (req) => streamerDashboard(ctx, await streamerOf(ctx, req), req.query.range));

  // ----------------------------------------------------------- S8 / A6
  r.get("/v1/streamer/profile", S, async (req) => streamers.profileView(ctx, await streamerOf(ctx, req)));
  r.patch("/v1/streamer/profile", { ...S, schema: { body: UpdateProfileBody } }, async (req) => {
    const s = await streamerOf(ctx, req);
    await ctx.db.update(schema.streamers).set(req.body).where(eq(schema.streamers.id, s.id));
    await audit(ctx, { actorId: s.userId, actorType: "streamer", action: "profile.updated", streamerId: s.id, data: { fields: Object.keys(req.body) } });
    return streamers.profileView(ctx, await streamers.streamerById(ctx, s.id));
  });
  /** RN-CON-03: mudar o nome de utilizador (endereço público), no máximo 1 vez a cada 30 dias. */
  r.put("/v1/streamer/handle", { ...S, schema: { body: z.object({ handle: Handle }) } }, async (req) => {
    const s = await streamerOf(ctx, req);
    const handle = req.body.handle;
    if (handle === s.handle) return streamers.profileView(ctx, s);
    const last = s.handleChangedAt ?? null;
    if (last && ctx.now().getTime() - last.getTime() < 30 * 86400_000) {
      const next = new Date(last.getTime() + 30 * 86400_000);
      throw new AppError(409, "handle_change_too_soon", `Só podes mudar o nome de utilizador 1 vez a cada 30 dias. Próxima mudança a partir de ${next.toLocaleDateString("pt-AO", { timeZone: "Africa/Luanda" })}.`);
    }
    if (!(await streamers.isHandleAvailable(ctx, handle))) throw new AppError(409, "handle_taken", "Este nome de utilizador já está a ser usado.", { field: "handle" });
    await ctx.db.update(schema.streamers).set({ handle, handleChangedAt: ctx.now() }).where(eq(schema.streamers.id, s.id));
    await audit(ctx, { actorId: s.userId, actorType: "streamer", action: "profile.handle_changed", streamerId: s.id, data: { before: s.handle, after: handle } });
    return streamers.profileView(ctx, await streamers.streamerById(ctx, s.id));
  });
  for (const kind of ["avatar", "banner"] as const) {
    r.post(`/v1/streamer/profile/${kind}`, S, async (req) => {
      const s = await streamerOf(ctx, req);
      const file = await req.file({ limits: { fileSize: 3 * 1024 * 1024 } });
      if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) throw unprocessable("file_type", "Envia uma imagem JPG, PNG ou WebP.");
      const data = await file.toBuffer();
      if (file.file.truncated) throw unprocessable("file_too_large", "A imagem pode ter no máximo 3 MB.");
      const key = `images/${s.id}/${kind}-${uuid().slice(0, 8)}.${extForMime(file.mimetype)}`;
      await ctx.storage.put(key, data, file.mimetype);
      await ctx.db.update(schema.streamers).set(kind === "avatar" ? { avatarUrl: ctx.storage.publicUrl(key) } : { bannerUrl: ctx.storage.publicUrl(key) }).where(eq(schema.streamers.id, s.id));
      return streamers.profileView(ctx, await streamers.streamerById(ctx, s.id));
    });
  }
  /** "Onde fazes live?" → guia, modo de saída sugerido e W5 permitido ou não. */
  r.post("/v1/streamer/onboarding", { ...S, schema: { body: OnboardingBody } }, async (req) => {
    const s = await streamerOf(ctx, req);
    const guide = streamers.onboardingGuide(req.body.platform, req.body.device);
    await ctx.db.update(schema.streamers).set({ platform: req.body.platform, device: req.body.device, outputMode: guide.outputMode }).where(eq(schema.streamers.id, s.id));
    return guide;
  });
  r.post("/v1/streamer/onboarding/complete", S, async (req) => {
    const s = await streamerOf(ctx, req);
    await ctx.db.update(schema.streamers).set({ onboardingCompletedAt: ctx.now() }).where(eq(schema.streamers.id, s.id));
    return streamers.profileView(ctx, await streamers.streamerById(ctx, s.id));
  });
  r.put("/v1/streamer/live", { ...S, schema: { body: SetLiveBody } }, async (req) => {
    const s = await streamerOf(ctx, req);
    await ctx.db.update(schema.streamers).set({ isLive: req.body.isLive }).where(eq(schema.streamers.id, s.id));
    return { isLive: req.body.isLive };
  });

  // ----------------------------------------------------------- S5
  r.get("/v1/streamer/pricing", S, async (req) => getPricing(ctx, (await streamerOf(ctx, req)).id));
  r.put("/v1/streamer/pricing", S, async (req) => {
    const s = await streamerOf(ctx, req);
    const p = await updatePricing(ctx, s.id, req.body);
    await audit(ctx, { actorId: s.userId, actorType: "streamer", action: "pricing.updated", streamerId: s.id });
    return p;
  });

  // ----------------------------------------------------------- S9
  r.get("/v1/streamer/filters", S, async (req) => {
    const s = await streamerOf(ctx, req);
    const w = await blockedWordsFor(ctx, s.id);
    const p = await getPricing(ctx, s.id);
    return {
      alwaysOn: { links: true, emails: true, phones: true, qr: true }, blockedWords: w.own, baseWordsCount: w.base.length,
      audioEnabled: p.audioEnabled, audioMaxSeconds: Math.max(0, ...p.audioTiers.map((t) => t.seconds)),
    };
  });
  r.put("/v1/streamer/filters", { ...S, schema: { body: UpdateFiltersBody } }, async (req) => {
    const s = await streamerOf(ctx, req);
    const words = await setStreamerWords(ctx, s.id, req.body.blockedWords);
    await audit(ctx, { actorId: s.userId, actorType: "streamer", action: "filters.updated", streamerId: s.id, data: { count: words.length } });
    return { blockedWords: words };
  });
  r.get("/v1/streamer/blocked-donors", S, async (req) => {
    const s = await streamerOf(ctx, req);
    const rows = await ctx.db.select().from(schema.blockedDonors).where(eq(schema.blockedDonors.streamerId, s.id)).orderBy(desc(schema.blockedDonors.createdAt));
    return { items: rows.map((b) => ({ id: b.id, phone: b.phone, deviceId: b.deviceId, reason: b.reason, createdAt: b.createdAt.toISOString() })) };
  });
  r.post("/v1/streamer/blocked-donors", { ...S, schema: { body: BlockDonorBody } }, async (req, reply) => {
    const s = await streamerOf(ctx, req);
    const id = await blockDonor(ctx, s.id, req.body);
    return reply.status(201).send({ id });
  });
  r.delete("/v1/streamer/blocked-donors/:id", { ...S, schema: { params: Id } }, async (req) => {
    const s = await streamerOf(ctx, req);
    await ctx.db.delete(schema.blockedDonors).where(and(eq(schema.blockedDonors.id, req.params.id), eq(schema.blockedDonors.streamerId, s.id)));
    return { ok: true };
  });

  // ----------------------------------------------------------- S2 fila ao vivo
  r.get("/v1/streamer/queue", S, async (req) => snapshot(ctx, (await streamerOf(ctx, req)).id));
  r.post("/v1/streamer/queue/:id/replay", { ...S, schema: { params: Id } }, async (req) => {
    const s = await streamerOf(ctx, req);
    return playback.replay(ctx, s, req.params.id, actor(s.userId));
  });
  /** Bloqueia o remetente para mensagens futuras; a mensagem já paga toca na mesma. */
  r.post("/v1/streamer/queue/:id/block-sender", { ...S, schema: { params: Id } }, async (req) => {
    const s = await streamerOf(ctx, req);
    const o = await ctx.db.query.orders.findFirst({ where: and(eq(schema.orders.id, req.params.id), eq(schema.orders.streamerId, s.id)) });
    if (!o) throw notFound("Mensagem");
    if (!o.donorPhone && !o.deviceId) throw unprocessable("no_identifier", "Esta mensagem não tem telemóvel nem dispositivo para bloquear.");
    await blockDonor(ctx, s.id, { phone: o.donorPhone, deviceId: o.deviceId, reason: `Bloqueado a partir da mensagem ${o.id}` });
    await audit(ctx, { actorId: s.userId, actorType: "streamer", action: "donor.blocked", targetType: "order", targetId: o.id, streamerId: s.id });
    return { ok: true };
  });
  r.post("/v1/streamer/queue/:id/report", { ...S, schema: { params: Id, body: ReportBody } }, async (req, reply) => {
    const s = await streamerOf(ctx, req);
    return reply.status(201).send(await support.reportContent(ctx, s.id, req.params.id, req.body.reason, s.userId));
  });
  r.put("/v1/streamer/playback", { ...S, schema: { body: PlaybackSettingsBody } }, async (req) => {
    const s = await streamerOf(ctx, req);
    const { volume, ...rest } = req.body;
    if (Object.keys(rest).length) await ctx.db.update(schema.streamers).set(rest).where(eq(schema.streamers.id, s.id));
    if (volume !== undefined) await playback.setVolume(ctx, s, volume, actor(s.userId));
    await publishSnapshot(ctx, s.id);
    void playback.engine(ctx).pump(s.id);
    return streamers.profileView(ctx, await streamers.streamerById(ctx, s.id));
  });

  // ----------------------------------------------------------- S6 overlay e widgets
  r.get("/v1/streamer/widgets", S, async (req) => {
    const s = await streamerOf(ctx, req);
    return { outputMode: s.outputMode, platform: s.platform, widgets: await widgets.widgetsView(ctx, s) };
  });
  r.put("/v1/streamer/widgets/:kind", { ...S, schema: { params: z.object({ kind: WidgetKind }), body: UpdateWidgetBody } }, async (req) => {
    const s = await streamerOf(ctx, req);
    await widgets.updateWidget(ctx, s, req.params.kind, req.body, s.userId);
    return (await widgets.widgetsView(ctx, s)).find((w) => w.kind === req.params.kind);
  });
  r.post("/v1/streamer/widgets/:kind/regenerate", { ...S, schema: { params: z.object({ kind: WidgetKind }) } }, async (req) => {
    const s = await streamerOf(ctx, req);
    return { url: await widgets.regenerateWidget(ctx, s, req.params.kind, s.userId) };
  });
  r.post("/v1/streamer/widgets/test-alert", S, async (req) => {
    const s = await streamerOf(ctx, req);
    return playback.testAlert(ctx, s, actor(s.userId));
  });

  // ----------------------------------------------------------- S4 histórico
  const historyWhere = (sid: string, q: z.infer<typeof HistoryQuery>) => and(
    eq(schema.orders.streamerId, sid),
    q.status ? eq(schema.orders.status, q.status) : inArray(schema.orders.status, ["queued", "playing", "played", "failed", "refund_pending", "refunded"]),
    q.kind ? eq(schema.orders.kind, q.kind) : undefined,
    q.from ? gte(schema.orders.createdAt, new Date(q.from)) : undefined,
    q.to ? lte(schema.orders.createdAt, new Date(q.to)) : undefined,
    q.minAmount ? gte(schema.orders.amount, q.minAmount) : undefined,
    q.maxAmount ? lte(schema.orders.amount, q.maxAmount) : undefined,
    q.q ? or(ilike(schema.orders.donorName, `%${q.q}%`), ilike(schema.orders.text, `%${q.q}%`), ilike(schema.orders.id, `%${q.q}%`), ilike(schema.orders.donorPhone, `%${q.q}%`)) : undefined,
  );
  const historyItem = async (o: typeof schema.orders.$inferSelect) => {
    const p = await ctx.db.query.payments.findFirst({ where: eq(schema.payments.orderId, o.id), orderBy: desc(schema.payments.createdAt) });
    return {
      id: o.id, createdAt: o.createdAt.toISOString(), paidAt: o.paidAt?.toISOString() ?? null, playedAt: o.playedAt?.toISOString() ?? null,
      donorName: o.donorName, donorPhoneMasked: maskPhone(o.donorPhone), kind: o.kind as "text", text: o.text, lines: o.lines, amount: o.amount,
      fee: o.feeAmount, net: o.netAmount, status: o.status as "played", method: p?.method ?? null, audioUrl: o.audioKey ? ctx.storage.publicUrl(o.audioKey) : null, tags: tagsOf(o),
    };
  };
  r.get("/v1/streamer/messages", { ...S, schema: { querystring: HistoryQuery } }, async (req) => {
    const s = await streamerOf(ctx, req);
    const where = historyWhere(s.id, req.query);
    const [c] = await ctx.db.select({ n: sql<string>`count(*)` }).from(schema.orders).where(where);
    const rows = await ctx.db.select().from(schema.orders).where(where).orderBy(desc(schema.orders.createdAt)).limit(req.query.pageSize).offset((req.query.page - 1) * req.query.pageSize);
    return { items: await Promise.all(rows.map(historyItem)), total: Number(c!.n), page: req.query.page, pageSize: req.query.pageSize };
  });
  r.get("/v1/streamer/messages/export.csv", { ...S, schema: { querystring: HistoryQuery } }, async (req, reply) => {
    const s = await streamerOf(ctx, req);
    const rows = await ctx.db.select().from(schema.orders).where(historyWhere(s.id, req.query)).orderBy(desc(schema.orders.createdAt)).limit(10000);
    const csv = toCsv([["pedido", "data", "doador", "tipo", "mensagem", "valor_kz", "comissao_kz", "liquido_kz", "estado"],
      ...rows.map((o) => [o.id, o.createdAt.toISOString(), o.donorName, o.kind, o.text ?? "", o.amount, o.feeAmount, o.netAmount, o.status])]);
    return reply.header("Content-Type", "text/csv; charset=utf-8").header("Content-Disposition", `attachment; filename="fedha-mensagens.csv"`).send(csv);
  });
  r.get("/v1/streamer/messages/:id", { ...S, schema: { params: Id } }, async (req) => {
    const s = await streamerOf(ctx, req);
    const o = await ctx.db.query.orders.findFirst({ where: and(eq(schema.orders.id, req.params.id), eq(schema.orders.streamerId, s.id)) });
    if (!o) throw notFound("Mensagem");
    return historyItem(o);
  });
  /** Pedido de reembolso ao suporte por falha técnica. */
  r.post("/v1/streamer/messages/:id/refund-request", { ...S, schema: { params: Id, body: RefundRequestBody } }, async (req, reply) => {
    const s = await streamerOf(ctx, req);
    const o = await ctx.db.query.orders.findFirst({ where: and(eq(schema.orders.id, req.params.id), eq(schema.orders.streamerId, s.id)) });
    if (!o) throw notFound("Mensagem");
    return reply.status(201).send(await support.createTicket(ctx, s.userId, { subject: `Reembolso por falha técnica · ${o.id}`, category: "refund", body: req.body.reason, orderId: o.id }));
  });

  // ----------------------------------------------------------- S7 metas
  r.get("/v1/streamer/goals", S, async (req) => ({ items: await goals.listGoals(ctx, (await streamerOf(ctx, req)).id) }));
  r.post("/v1/streamer/goals", { ...S, schema: { body: CreateGoalBody } }, async (req, reply) => reply.status(201).send(await goals.createGoal(ctx, (await streamerOf(ctx, req)).id, req.body)));
  r.post("/v1/streamer/goals/:id/close", { ...S, schema: { params: Id } }, async (req) => goals.closeGoal(ctx, (await streamerOf(ctx, req)).id, req.params.id));

  // ----------------------------------------------------------- S11 / S12 carteira
  r.get("/v1/streamer/wallet", S, async (req) => {
    const s = await streamerOf(ctx, req);
    const settings = await getSettings(ctx);
    const b = await wallet.streamerBalances(ctx.db, s.id);
    const month = await wallet.monthTotals(ctx, s.id, new Date(ctx.now().getTime() - 30 * 86400_000));
    const blockers = await withdrawals.blockers(ctx, s);
    return {
      available: b.available, pending: b.pending, nextReleaseAt: (await wallet.nextReleaseAt(ctx, s.id, settings.retentionHours))?.toISOString() ?? null,
      month, withdrawal: { fee: settings.withdrawalFee, min: settings.withdrawalMin, canWithdraw: blockers.length === 0 && b.available >= settings.withdrawalMin + settings.withdrawalFee, blockers },
    };
  });
  r.get("/v1/streamer/ledger", { ...S, schema: { querystring: LedgerQuery } }, async (req) => {
    const s = await streamerOf(ctx, req);
    return wallet.ledgerRows(ctx, s.id, { from: req.query.from ? new Date(req.query.from) : undefined, to: req.query.to ? new Date(req.query.to) : undefined, page: req.query.page, pageSize: req.query.pageSize });
  });
  r.get("/v1/streamer/ledger/export.csv", S, async (req, reply) => {
    const s = await streamerOf(ctx, req);
    const { items } = await wallet.ledgerRows(ctx, s.id, { page: 1, pageSize: 100000 });
    const csv = toCsv([["data", "movimento", "conta", "valor_kz", "saldo_apos_kz", "referencia"], ...items.map((i) => [i.at, i.label, i.account === "pending" ? "pendente" : "disponível", i.amount, i.balanceAfter, i.refId ?? ""])]);
    return reply.header("Content-Type", "text/csv; charset=utf-8").header("Content-Disposition", `attachment; filename="fedha-extrato.csv"`).send(csv);
  });
  r.get("/v1/streamer/withdrawals", S, async (req) => ({ items: await withdrawals.listWithdrawals(ctx, (await streamerOf(ctx, req)).id) }));
  r.get("/v1/streamer/withdrawals/quote", { ...S, schema: { querystring: WithdrawalQuoteQuery } }, async (req) => withdrawals.quote(ctx, await streamerOf(ctx, req), req.query.amount));
  r.post("/v1/streamer/withdrawals", { ...S, schema: { body: CreateWithdrawalBody }, config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req, reply) =>
    reply.status(201).send(await withdrawals.requestWithdrawal(ctx, await streamerOf(ctx, req), req.body, ipOf(req))));

  // ----------------------------------------------------------- A7 KYC
  r.get("/v1/streamer/kyc", S, async (req) => kyc.getKyc(ctx, await streamerOf(ctx, req)));
  r.post("/v1/streamer/kyc", S, async (req, reply) => {
    const s = await streamerOf(ctx, req);
    const fields: Record<string, string> = {};
    const files: kyc.UploadedFile[] = [];
    for await (const part of req.parts({ limits: { fileSize: 8 * 1024 * 1024, files: 5 } })) {
      if (part.type === "file") files.push({ field: part.fieldname, mime: part.mimetype, data: await part.toBuffer() });
      else fields[part.fieldname] = String(part.value);
    }
    const id = await kyc.submitKyc(ctx, s, fields, files, s.userId);
    return reply.status(201).send({ id, ...(await kyc.getKyc(ctx, await streamers.streamerById(ctx, s.id))) });
  });

  // ----------------------------------------------------------- S10 assistentes
  r.get("/v1/streamer/assistants", S, async (req) => ({ items: await assistants.listAssistants(ctx, (await streamerOf(ctx, req)).id) }));
  r.post("/v1/streamer/assistants", { ...S, schema: { body: InviteAssistantBody } }, async (req, reply) => {
    const s = await streamerOf(ctx, req);
    return reply.status(201).send(await assistants.invite(ctx, s, req.body, s.userId));
  });
  r.delete("/v1/streamer/assistants/:id", { ...S, schema: { params: Id } }, async (req) => {
    const s = await streamerOf(ctx, req);
    await assistants.remove(ctx, s, req.params.id, s.userId);
    return { ok: true };
  });
  r.get("/v1/streamer/assistants/:id/actions", { ...S, schema: { params: Id } }, async (req) => ({ items: await assistants.actions(ctx, await streamerOf(ctx, req), req.params.id) }));

  // ----------------------------------------------------------- S13 notificações
  r.get("/v1/streamer/notification-preferences", S, async (req) => notifications.getPrefs(ctx, user(req).id));
  r.put("/v1/streamer/notification-preferences", { ...S, schema: { body: NotificationPrefs } }, async (req) => notifications.setPrefs(ctx, user(req).id, req.body as Record<string, string[]>));
  r.get("/v1/streamer/notifications", S, async (req) => ({ items: await notifications.listNotifications(ctx, user(req).id) }));
  r.post("/v1/streamer/notifications/read", { ...S, schema: { body: MarkReadBody } }, async (req) => { await notifications.markRead(ctx, user(req).id, req.body.ids); return { ok: true }; });

  // ----------------------------------------------------------- S15 suporte (streamer e assistente)
  const U = { preHandler: requireAuth(ctx, ["streamer", "assistant"]) };
  r.get("/v1/support/tickets", U, async (req) => ({ items: await support.myTickets(ctx, user(req).id) }));
  r.post("/v1/support/tickets", { ...U, schema: { body: CreateTicketBody } }, async (req, reply) => reply.status(201).send(await support.createTicket(ctx, user(req).id, req.body)));
  r.get("/v1/support/tickets/:id", { ...U, schema: { params: Id } }, async (req) => support.ticketFor(ctx, req.params.id, user(req).id));
  r.post("/v1/support/tickets/:id/messages", { ...U, schema: { params: Id, body: TicketMessageBody } }, async (req) => support.reply(ctx, req.params.id, { id: user(req).id, type: "user" }, req.body.body));

}
