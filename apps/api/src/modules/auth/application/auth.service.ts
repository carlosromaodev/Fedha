import { and, eq, isNull, ne, or } from "drizzle-orm";
import type { Me, RegisterBody } from "@fedha/contracts";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { AppError, badRequest, conflict, forbidden, notFound, unauthorized, unprocessable } from "../../../shared/errors/app-error";
import { secretToken, uuid } from "../../../shared/security/ids";
import { decryptText, encryptText, hashPassword, sha256, verifyPassword } from "../../../shared/security/crypto";
import { generateTotpSecret, otpauthUrl, verifyTotp } from "../../../shared/security/totp";
import { signJwt, verifyJwt } from "../../../shared/security/jwt";
import { audit } from "../../../shared/audit/audit";
import { consumeOtp, sendOtp, type OtpPurpose } from "./otp.service";
import { isHandleAvailable, streamerByUser } from "../../streamers/application/streamers.service";
import { ensureWidgets } from "../../playback/application/widgets.service";
import { streamerBalances } from "../../wallet/domain/ledger";

export type User = typeof schema.users.$inferSelect;
export interface AccessClaims { sub: string; sid: string; role: string }

const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60_000;

// ------------------------------------------------------------- utilitários
export async function userById(ctx: Ctx, id: string): Promise<User> {
  const u = await ctx.db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!u || u.status === "deleted") throw notFound("Utilizador");
  return u;
}

async function userByIdentifier(ctx: Ctx, identifier: string) {
  const id = identifier.trim().toLowerCase();
  const phone = id.replace(/[\s.-]/g, "").replace(/^(\+?244|00244)/, "");
  return ctx.db.query.users.findFirst({ where: or(eq(schema.users.email, id), eq(schema.users.phone, phone)) });
}

export async function meView(ctx: Ctx, u: User): Promise<Me> {
  const s = u.role === "streamer" ? await streamerByUser(ctx, u.id) : undefined;
  return {
    id: u.id, role: u.role as Me["role"], adminRole: (u.adminRole as Me["adminRole"]) ?? null, displayName: u.displayName, email: u.email, phone: u.phone,
    emailVerified: !!u.emailVerifiedAt, phoneVerified: !!u.phoneVerifiedAt, twoFactor: (u.twoFactorMethod as "totp" | "sms" | null) ?? null,
    streamer: s ? { id: s.id, handle: s.handle, kycStatus: s.kycStatus, onboardingCompleted: !!s.onboardingCompletedAt } : null,
    createdAt: u.createdAt.toISOString(),
  };
}

function ageOn(birth: string, now: Date) {
  const [y, m, d] = birth.split("-").map(Number) as [number, number, number];
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d)) age--;
  return age;
}

// ------------------------------------------------------------- sessões e tokens
async function issueTokens(ctx: Ctx, u: User, meta: { ip: string | null; userAgent: string | null }) {
  const sid = uuid();
  const secret = secretToken(32);
  const now = ctx.now();
  await ctx.db.insert(schema.sessions).values({
    id: sid, userId: u.id, refreshHash: sha256(secret), ip: meta.ip, userAgent: meta.userAgent, createdAt: now, lastUsedAt: now,
    expiresAt: new Date(now.getTime() + ctx.env.REFRESH_TOKEN_TTL_DAYS * 86400_000),
  });
  return { ...accessFor(ctx, u, sid), refreshToken: `${sid}.${secret}`, user: await meView(ctx, u) };
}

function accessFor(ctx: Ctx, u: User, sid: string) {
  const ttl = ctx.env.ACCESS_TOKEN_TTL_MIN * 60;
  return { accessToken: signJwt({ sub: u.id, sid, role: u.role }, ctx.env.JWT_SECRET, ttl, ctx.now().getTime()), expiresIn: ttl };
}

/** Valida o access token e confirma que a sessão não foi terminada. */
export async function authenticate(ctx: Ctx, token: string): Promise<{ user: User; sessionId: string }> {
  const claims = verifyJwt<AccessClaims>(token, ctx.env.JWT_SECRET, ctx.now().getTime());
  if (!claims || !claims.sid) throw unauthorized();
  const session = await ctx.db.query.sessions.findFirst({ where: eq(schema.sessions.id, claims.sid) });
  if (!session || session.revokedAt || session.expiresAt < ctx.now()) throw unauthorized();
  const user = await ctx.db.query.users.findFirst({ where: eq(schema.users.id, claims.sub) });
  if (!user || user.status !== "active") throw unauthorized("Conta suspensa ou inexistente.", "account_inactive");
  return { user, sessionId: session.id };
}

export async function refresh(ctx: Ctx, refreshToken: string) {
  const [sid, secret] = refreshToken.split(".");
  if (!sid || !secret) throw unauthorized();
  const s = await ctx.db.query.sessions.findFirst({ where: eq(schema.sessions.id, sid) });
  if (!s || s.revokedAt || s.expiresAt < ctx.now()) throw unauthorized();
  if (s.refreshHash !== sha256(secret)) {
    // Reutilização de um refresh token antigo: termina a sessão por segurança.
    await ctx.db.update(schema.sessions).set({ revokedAt: ctx.now() }).where(eq(schema.sessions.id, s.id));
    throw unauthorized();
  }
  const u = await userById(ctx, s.userId);
  if (u.status !== "active") throw unauthorized("Conta suspensa.", "account_inactive");
  const next = secretToken(32);
  await ctx.db.update(schema.sessions).set({ refreshHash: sha256(next), lastUsedAt: ctx.now() }).where(eq(schema.sessions.id, s.id));
  return { ...accessFor(ctx, u, s.id), refreshToken: `${s.id}.${next}` };
}

export async function logout(ctx: Ctx, sessionId: string) {
  await ctx.db.update(schema.sessions).set({ revokedAt: ctx.now() }).where(eq(schema.sessions.id, sessionId));
}

export async function listSessions(ctx: Ctx, userId: string, currentSid: string) {
  const rows = await ctx.db.select().from(schema.sessions).where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
  return rows.filter((r) => r.expiresAt > ctx.now()).map((r) => ({
    id: r.id, userAgent: r.userAgent, ip: r.ip, createdAt: r.createdAt.toISOString(), lastUsedAt: r.lastUsedAt.toISOString(), current: r.id === currentSid,
  }));
}

export async function revokeSessions(ctx: Ctx, userId: string, opts: { only?: string; except?: string }) {
  const conds = [eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)];
  if (opts.only) conds.push(eq(schema.sessions.id, opts.only));
  if (opts.except) conds.push(ne(schema.sessions.id, opts.except));
  await ctx.db.update(schema.sessions).set({ revokedAt: ctx.now() }).where(and(...conds));
}

// ------------------------------------------------------------- A1 / A2
export async function register(ctx: Ctx, body: RegisterBody, meta: { ip: string | null; userAgent: string | null }) {
  if (ageOn(body.birthDate, ctx.now()) < 18) throw unprocessable("underage", "Tens de ter pelo menos 18 anos para criar uma conta de streamer.", { field: "birthDate" });
  if (!(await isHandleAvailable(ctx, body.handle))) throw conflict("handle_taken", "Esse nome de utilizador já está ocupado.", { field: "handle" });
  if (await ctx.db.query.users.findFirst({ where: eq(schema.users.email, body.email) })) throw conflict("email_taken", "Já existe uma conta com este email.", { field: "email" });
  if (await ctx.db.query.users.findFirst({ where: eq(schema.users.phone, body.phone) })) throw conflict("phone_taken", "Já existe uma conta com este telemóvel.", { field: "phone" });

  const now = ctx.now();
  const userId = uuid();
  const streamerId = uuid();
  await ctx.db.transaction(async (tx) => {
    await tx.insert(schema.users).values({
      id: userId, role: "streamer", displayName: body.displayName, email: body.email, phone: body.phone, passwordHash: await hashPassword(body.password),
      birthDate: body.birthDate, createdAt: now, updatedAt: now,
    });
    await tx.insert(schema.streamers).values({ id: streamerId, userId, handle: body.handle, displayName: body.displayName, createdAt: now });
    await tx.insert(schema.notificationPrefs).values({ userId, prefs: DEFAULT_PREFS });
  });
  await ensureWidgets(ctx, streamerId);
  const phoneCode = await sendOtp(ctx, { target: body.phone, purpose: "verify_phone", userId });
  const emailCode = await sendOtp(ctx, { target: body.email, purpose: "verify_email", userId });
  await audit(ctx, { actorId: userId, actorType: "streamer", action: "auth.register", streamerId, ip: meta.ip });
  const tokens = await issueTokens(ctx, await userById(ctx, userId), meta);
  return { ...tokens, ...(phoneCode ? { devCodes: { phone: phoneCode, email: emailCode } } : {}) };
}

export const DEFAULT_PREFS = {
  new_message: ["push"], report_reviewed: ["email"], withdrawal_paid: ["email", "sms"], withdrawal_rejected: ["email", "sms"],
  kyc_decided: ["email", "sms"], refund: ["email"], security: ["email", "sms"],
};

export async function verifyContact(ctx: Ctx, u: User, kind: "phone" | "email", code: string) {
  const target = kind === "phone" ? u.phone : u.email;
  if (!target) throw badRequest("no_contact", "Sem contacto para verificar.");
  await consumeOtp(ctx, target, kind === "phone" ? "verify_phone" : "verify_email", code);
  await ctx.db.update(schema.users).set(kind === "phone" ? { phoneVerifiedAt: ctx.now() } : { emailVerifiedAt: ctx.now() }).where(eq(schema.users.id, u.id));
  return meView(ctx, await userById(ctx, u.id));
}

export async function resendVerification(ctx: Ctx, u: User, channel: "sms" | "email") {
  if (channel === "sms") {
    if (!u.phone || u.phoneVerifiedAt) throw badRequest("already_verified", "O telemóvel já está verificado.");
    return sendOtp(ctx, { target: u.phone, purpose: "verify_phone", userId: u.id });
  }
  if (u.emailVerifiedAt) throw badRequest("already_verified", "O email já está verificado.");
  return sendOtp(ctx, { target: u.email, purpose: "verify_email", userId: u.id });
}

// ------------------------------------------------------------- A3 / A5
export async function login(ctx: Ctx, identifier: string, password: string, meta: { ip: string | null; userAgent: string | null }) {
  const u = await userByIdentifier(ctx, identifier);
  const now = ctx.now();
  if (!u || u.status === "deleted") {
    await hashPassword(password); // tempo constante
    throw unauthorized("Email, telefone ou palavra-passe errados.", "invalid_credentials");
  }
  if (u.lockedUntil && u.lockedUntil > now) throw new AppError(423, "account_locked", "Conta bloqueada temporariamente por tentativas falhadas. Tenta daqui a 15 minutos ou recupera a palavra-passe.");
  if (!(await verifyPassword(password, u.passwordHash))) {
    const failed = u.failedLogins + 1;
    await ctx.db.update(schema.users).set({ failedLogins: failed, lockedUntil: failed >= LOCK_AFTER ? new Date(now.getTime() + LOCK_MS) : null }).where(eq(schema.users.id, u.id));
    await audit(ctx, { actorId: u.id, actorType: u.role as "streamer", action: "auth.login_failed", ip: meta.ip });
    throw unauthorized("Email, telefone ou palavra-passe errados.", "invalid_credentials");
  }
  if (u.status === "suspended") throw forbidden("A tua conta está suspensa. Contacta o suporte.", "account_suspended");
  await ctx.db.update(schema.users).set({ failedLogins: 0, lockedUntil: null }).where(eq(schema.users.id, u.id));
  if (u.twoFactorMethod) {
    if (u.twoFactorMethod === "sms" && u.phone) await sendOtp(ctx, { target: u.phone, purpose: "login_2fa", userId: u.id }).catch(() => undefined);
    const challengeToken = signJwt({ sub: u.id, purpose: "2fa" }, ctx.env.JWT_SECRET, 300, now.getTime());
    return { twoFactorRequired: true as const, challengeToken, method: u.twoFactorMethod as "totp" | "sms" };
  }
  await audit(ctx, { actorId: u.id, actorType: u.role as "streamer", action: "auth.login", ip: meta.ip });
  return issueTokens(ctx, u, meta);
}

export async function completeTwoFactor(ctx: Ctx, challengeToken: string, code: string, meta: { ip: string | null; userAgent: string | null }) {
  const c = verifyJwt<{ sub: string; purpose: string }>(challengeToken, ctx.env.JWT_SECRET, ctx.now().getTime());
  if (!c || c.purpose !== "2fa") throw unauthorized("O pedido de entrada expirou. Entra de novo.", "challenge_expired");
  const u = await userById(ctx, c.sub);
  await verifySecondFactor(ctx, u, code, "login_2fa");
  await audit(ctx, { actorId: u.id, actorType: u.role as "streamer", action: "auth.login", ip: meta.ip, data: { twoFactor: true } });
  return issueTokens(ctx, u, meta);
}

/** Código TOTP, SMS (para o fim indicado) ou código de recuperação (gasto ao usar). */
export async function verifySecondFactor(ctx: Ctx, u: User, code: string, smsPurpose: OtpPurpose) {
  const clean = code.trim().replace(/\s/g, "");
  if (u.twoFactorMethod === "totp" && u.totpSecretEnc && /^\d{6}$/.test(clean)) {
    if (verifyTotp(decryptText(ctx.env.ENCRYPTION_KEY, u.totpSecretEnc), clean, ctx.now().getTime())) return;
  }
  if (u.twoFactorMethod === "sms" && u.phone && /^\d{6}$/.test(clean)) {
    await consumeOtp(ctx, u.phone, smsPurpose, clean);
    return;
  }
  const hashed = sha256(clean.toUpperCase());
  if (u.recoveryCodes.includes(hashed)) {
    await ctx.db.update(schema.users).set({ recoveryCodes: u.recoveryCodes.filter((h) => h !== hashed) }).where(eq(schema.users.id, u.id));
    return;
  }
  throw badRequest("2fa_invalid", "Código de verificação errado.", { field: "code" });
}

export async function sendSecondFactorSms(ctx: Ctx, u: User, purpose: "withdrawal" | "login_2fa" | "delete_account") {
  if (u.twoFactorMethod !== "sms" || !u.phone) throw badRequest("2fa_not_sms", "A tua verificação em dois passos não é por SMS.");
  return sendOtp(ctx, { target: u.phone, purpose, userId: u.id });
}

export async function setupTotp(ctx: Ctx, u: User) {
  const secret = generateTotpSecret();
  await ctx.db.update(schema.users).set({ totpPendingEnc: encryptText(ctx.env.ENCRYPTION_KEY, secret) }).where(eq(schema.users.id, u.id));
  return { secret, otpauthUrl: otpauthUrl(secret, u.email) };
}

export async function enableTwoFactor(ctx: Ctx, u: User, method: "totp" | "sms", code: string) {
  if (method === "totp") {
    if (!u.totpPendingEnc) throw badRequest("totp_not_setup", "Começa por configurar a app autenticadora.");
    const secret = decryptText(ctx.env.ENCRYPTION_KEY, u.totpPendingEnc);
    if (!verifyTotp(secret, code, ctx.now().getTime())) throw badRequest("2fa_invalid", "Código errado.", { field: "code" });
    await ctx.db.update(schema.users).set({ twoFactorMethod: "totp", totpSecretEnc: u.totpPendingEnc, totpPendingEnc: null }).where(eq(schema.users.id, u.id));
  } else {
    if (!u.phone || !u.phoneVerifiedAt) throw badRequest("phone_unverified", "Verifica o teu telemóvel primeiro.");
    await consumeOtp(ctx, u.phone, "enable_2fa", code);
    await ctx.db.update(schema.users).set({ twoFactorMethod: "sms" }).where(eq(schema.users.id, u.id));
  }
  await audit(ctx, { actorId: u.id, actorType: u.role as "streamer", action: "auth.2fa_enabled", data: { method } });
  return { recoveryCodes: await regenerateRecoveryCodes(ctx, u.id) };
}

export async function requestSms2faEnable(ctx: Ctx, u: User) {
  if (!u.phone || !u.phoneVerifiedAt) throw badRequest("phone_unverified", "Verifica o teu telemóvel primeiro.");
  return sendOtp(ctx, { target: u.phone, purpose: "enable_2fa", userId: u.id });
}

export async function regenerateRecoveryCodes(ctx: Ctx, userId: string) {
  const codes = Array.from({ length: 10 }, () => secretToken(6).replace(/[-_]/g, "X").slice(0, 8).toUpperCase());
  await ctx.db.update(schema.users).set({ recoveryCodes: codes.map((c) => sha256(c)) }).where(eq(schema.users.id, userId));
  return codes;
}

export async function disableTwoFactor(ctx: Ctx, u: User, code: string, password: string) {
  if (!(await verifyPassword(password, u.passwordHash))) throw unauthorized("Palavra-passe errada.", "invalid_password");
  await verifySecondFactor(ctx, u, code, "login_2fa");
  await ctx.db.update(schema.users).set({ twoFactorMethod: null, totpSecretEnc: null, recoveryCodes: [] }).where(eq(schema.users.id, u.id));
  await audit(ctx, { actorId: u.id, actorType: u.role as "streamer", action: "auth.2fa_disabled" });
}

// ------------------------------------------------------------- A4 recuperação
export async function forgotPassword(ctx: Ctx, identifier: string, channel: "sms" | "email") {
  const u = await userByIdentifier(ctx, identifier);
  // Resposta igual exista ou não a conta (não revela contas).
  if (!u || u.status === "deleted") return undefined;
  const target = channel === "sms" && u.phone ? u.phone : u.email;
  return sendOtp(ctx, { target, purpose: "reset_password", userId: u.id }).catch(() => undefined);
}

export async function resetPassword(ctx: Ctx, identifier: string, code: string, newPassword: string) {
  const u = await userByIdentifier(ctx, identifier);
  if (!u) throw badRequest("otp_invalid", "Código inválido ou expirado.");
  let ok = false;
  for (const target of [u.phone, u.email].filter(Boolean) as string[]) {
    try { await consumeOtp(ctx, target, "reset_password", code); ok = true; break; } catch { /* tenta o outro canal */ }
  }
  if (!ok) throw badRequest("otp_invalid", "Código inválido ou expirado.", { field: "code" });
  await ctx.db.update(schema.users).set({ passwordHash: await hashPassword(newPassword), failedLogins: 0, lockedUntil: null, updatedAt: ctx.now() }).where(eq(schema.users.id, u.id));
  await revokeSessions(ctx, u.id, {});
  await audit(ctx, { actorId: u.id, actorType: u.role as "streamer", action: "auth.password_reset" });
}

// ------------------------------------------------------------- S14 conta
export async function changePassword(ctx: Ctx, u: User, sid: string, current: string, next: string) {
  if (!(await verifyPassword(current, u.passwordHash))) throw unauthorized("Palavra-passe atual errada.", "invalid_password");
  await ctx.db.update(schema.users).set({ passwordHash: await hashPassword(next), updatedAt: ctx.now() }).where(eq(schema.users.id, u.id));
  await revokeSessions(ctx, u.id, { except: sid });
  await audit(ctx, { actorId: u.id, actorType: u.role as "streamer", action: "auth.password_changed" });
}

export async function requestContactChange(ctx: Ctx, u: User, input: { email?: string; phone?: string }) {
  const target = input.email ?? input.phone!;
  const clash = await ctx.db.query.users.findFirst({ where: input.email ? eq(schema.users.email, target) : eq(schema.users.phone, target) });
  if (clash) throw conflict("contact_taken", "Esse contacto já está associado a outra conta.");
  return sendOtp(ctx, { target, purpose: "change_contact", userId: u.id, data: input });
}

export async function confirmContactChange(ctx: Ctx, u: User, code: string) {
  const row = await ctx.db.query.otpCodes.findFirst({
    where: and(eq(schema.otpCodes.userId, u.id), eq(schema.otpCodes.purpose, "change_contact"), isNull(schema.otpCodes.consumedAt)),
    orderBy: (t, { desc }) => desc(t.createdAt),
  });
  if (!row) throw badRequest("otp_invalid", "Código inválido ou expirado.");
  await consumeOtp(ctx, row.target, "change_contact", code);
  const data = row.data as { email?: string; phone?: string };
  await ctx.db.update(schema.users).set(data.email ? { email: data.email, emailVerifiedAt: ctx.now() } : { phone: data.phone!, phoneVerifiedAt: ctx.now() }).where(eq(schema.users.id, u.id));
  await audit(ctx, { actorId: u.id, actorType: u.role as "streamer", action: "auth.contact_changed", data: { field: data.email ? "email" : "phone" } });
  return meView(ctx, await userById(ctx, u.id));
}

/** Eliminar conta: só sem saldo por levantar. Dados pessoais anonimizados; registos financeiros mantidos (prazo legal). */
export async function deleteAccount(ctx: Ctx, u: User, password: string) {
  if (!(await verifyPassword(password, u.passwordHash))) throw unauthorized("Palavra-passe errada.", "invalid_password");
  const s = await streamerByUser(ctx, u.id);
  if (s) {
    const b = await streamerBalances(ctx.db, s.id);
    if (b.available > 0 || b.pending > 0) throw conflict("balance_remaining", "Ainda tens saldo. Levanta o valor antes de eliminar a conta.");
    await ctx.db.update(schema.streamers).set({ status: "removed", acceptingMessages: false, handle: `removido-${s.id.slice(0, 8)}` }).where(eq(schema.streamers.id, s.id));
  }
  await ctx.db.update(schema.users).set({ status: "deleted", email: `removido+${u.id}@fedha.invalid`, phone: null, displayName: "Conta eliminada", totpSecretEnc: null, recoveryCodes: [] }).where(eq(schema.users.id, u.id));
  await revokeSessions(ctx, u.id, {});
  await audit(ctx, { actorId: u.id, actorType: u.role as "streamer", action: "auth.account_deleted" });
}

/** Admin inicial a partir de ADMIN_EMAIL / ADMIN_PASSWORD. */
export async function ensureSuperAdmin(ctx: Ctx) {
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = ctx.env;
  if (!email || !password) return;
  if (await ctx.db.query.users.findFirst({ where: eq(schema.users.email, email.toLowerCase()) })) return;
  await ctx.db.insert(schema.users).values({
    id: uuid(), role: "admin", adminRole: "super_admin", displayName: "Super Admin", email: email.toLowerCase(), passwordHash: await hashPassword(password),
    emailVerifiedAt: ctx.now(), createdAt: ctx.now(), updatedAt: ctx.now(),
  });
  ctx.log.info({ email }, "super admin criado");
}
