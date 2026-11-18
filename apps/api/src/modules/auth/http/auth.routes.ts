import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  ChangeContactBody, ChangePasswordBody, ConfirmContactBody, DeleteAccountBody, Disable2faBody, Enable2faBody, ForgotPasswordBody, Handle,
  LoginBody, RefreshBody, RegisterBody, ResendOtpBody, ResetPasswordBody, TwoFactorVerifyBody, UpdateMeBody, VerifyCodeBody,
} from "@fedha/contracts";
import { eq } from "drizzle-orm";
import type { Ctx } from "../../../shared/context";
import { schema } from "../../../shared/database/client";
import { meta, requireAuth, user } from "../../../shared/http/auth";
import * as auth from "../application/auth.service";
import { isHandleAvailable } from "../../streamers/application/streamers.service";

const dev = (ctx: Ctx, code: string | undefined) => (code && (ctx.env.DEV_EXPOSE_OTP || ctx.env.NODE_ENV === "test") ? { devCode: code } : {});

export async function authRoutes(app: FastifyInstance, ctx: Ctx) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const strict = { rateLimit: { max: 10, timeWindow: "1 minute" } };
  const authed = { preHandler: requireAuth(ctx) };

  // ----------------------------------------------------------- A1 / A2
  r.post("/v1/auth/register", { schema: { body: RegisterBody }, config: strict }, async (req, reply) => reply.status(201).send(await auth.register(ctx, req.body, meta(req))));
  r.get("/v1/auth/handle-available", { schema: { querystring: z.object({ handle: z.string() }) } }, async (req) => {
    const p = Handle.safeParse(req.query.handle);
    if (!p.success) return { handle: req.query.handle, available: false, reason: p.error.issues[0]!.message };
    return { handle: p.data, available: await isHandleAvailable(ctx, p.data), reason: null };
  });
  r.post("/v1/auth/verify-phone", { ...authed, schema: { body: VerifyCodeBody }, config: strict }, async (req) => auth.verifyContact(ctx, user(req), "phone", req.body.code));
  r.post("/v1/auth/verify-email", { ...authed, schema: { body: VerifyCodeBody }, config: strict }, async (req) => auth.verifyContact(ctx, user(req), "email", req.body.code));
  r.post("/v1/auth/otp/resend", { ...authed, schema: { body: ResendOtpBody }, config: strict }, async (req) => ({ sent: true, ...dev(ctx, await auth.resendVerification(ctx, user(req), req.body.channel)) }));

  // ----------------------------------------------------------- A3 / A5
  r.post("/v1/auth/login", { schema: { body: LoginBody }, config: strict }, async (req) => auth.login(ctx, req.body.identifier, req.body.password, meta(req)));
  r.post("/v1/auth/2fa/verify", { schema: { body: TwoFactorVerifyBody }, config: strict }, async (req) => auth.completeTwoFactor(ctx, req.body.challengeToken, req.body.code, meta(req)));
  r.post("/v1/auth/refresh", { schema: { body: RefreshBody } }, async (req) => auth.refresh(ctx, req.body.refreshToken));
  r.post("/v1/auth/logout", authed, async (req) => { await auth.logout(ctx, req.auth!.sessionId); return { ok: true }; });

  // ----------------------------------------------------------- A4
  r.post("/v1/auth/password/forgot", { schema: { body: ForgotPasswordBody }, config: strict }, async (req) => ({ sent: true, ...dev(ctx, await auth.forgotPassword(ctx, req.body.identifier, req.body.channel)) }));
  r.post("/v1/auth/password/reset", { schema: { body: ResetPasswordBody }, config: strict }, async (req) => { await auth.resetPassword(ctx, req.body.identifier, req.body.code, req.body.newPassword); return { ok: true }; });

  // ----------------------------------------------------------- S14 conta
  r.get("/v1/me", authed, async (req) => auth.meView(ctx, user(req)));
  r.patch("/v1/me", { ...authed, schema: { body: UpdateMeBody } }, async (req) => {
    if (req.body.displayName) await ctx.db.update(schema.users).set({ displayName: req.body.displayName, updatedAt: ctx.now() }).where(eq(schema.users.id, user(req).id));
    return auth.meView(ctx, await auth.userById(ctx, user(req).id));
  });
  r.post("/v1/me/password", { ...authed, schema: { body: ChangePasswordBody } }, async (req) => { await auth.changePassword(ctx, user(req), req.auth!.sessionId, req.body.currentPassword, req.body.newPassword); return { ok: true }; });
  r.post("/v1/me/contact/change", { ...authed, schema: { body: ChangeContactBody }, config: strict }, async (req) => ({ sent: true, ...dev(ctx, await auth.requestContactChange(ctx, user(req), req.body)) }));
  r.post("/v1/me/contact/confirm", { ...authed, schema: { body: ConfirmContactBody }, config: strict }, async (req) => auth.confirmContactChange(ctx, user(req), req.body.code));
  r.delete("/v1/me", { ...authed, schema: { body: DeleteAccountBody } }, async (req) => { await auth.deleteAccount(ctx, user(req), req.body.password); return { ok: true }; });

  r.post("/v1/me/2fa/totp/setup", authed, async (req) => auth.setupTotp(ctx, user(req)));
  r.post("/v1/me/2fa/sms/send", { ...authed, config: strict, schema: { body: z.object({ purpose: z.enum(["enable", "withdrawal", "login_2fa"]).default("enable") }) } }, async (req) => {
    const u = user(req);
    const code = req.body.purpose === "enable" ? await auth.requestSms2faEnable(ctx, u) : await auth.sendSecondFactorSms(ctx, u, req.body.purpose);
    return { sent: true, ...dev(ctx, code) };
  });
  r.post("/v1/me/2fa/enable", { ...authed, schema: { body: Enable2faBody }, config: strict }, async (req) => auth.enableTwoFactor(ctx, user(req), req.body.method, req.body.code));
  r.post("/v1/me/2fa/disable", { ...authed, schema: { body: Disable2faBody }, config: strict }, async (req) => { await auth.disableTwoFactor(ctx, user(req), req.body.code, req.body.password); return { ok: true }; });
  r.post("/v1/me/2fa/recovery-codes", { ...authed, schema: { body: z.object({ code: z.string() }) }, config: strict }, async (req) => {
    await auth.verifySecondFactor(ctx, user(req), req.body.code, "login_2fa");
    return { recoveryCodes: await auth.regenerateRecoveryCodes(ctx, user(req).id) };
  });

  r.get("/v1/me/sessions", authed, async (req) => ({ items: await auth.listSessions(ctx, user(req).id, req.auth!.sessionId) }));
  r.delete("/v1/me/sessions/:id", { ...authed, schema: { params: z.object({ id: z.string() }) } }, async (req) => { await auth.revokeSessions(ctx, user(req).id, { only: req.params.id }); return { ok: true }; });
  r.delete("/v1/me/sessions", authed, async (req) => { await auth.revokeSessions(ctx, user(req).id, { except: req.auth!.sessionId }); return { ok: true }; });
}
