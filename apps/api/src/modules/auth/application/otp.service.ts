import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { badRequest, tooMany } from "../../../shared/errors/app-error";
import { numericCode, uuid } from "../../../shared/security/ids";
import { sha256 } from "../../../shared/security/crypto";

export type OtpPurpose = "verify_phone" | "verify_email" | "reset_password" | "login_2fa" | "change_contact" | "withdrawal" | "enable_2fa" | "delete_account";

const TTL_MS = 10 * 60_000;
const COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;

const TEXT: Record<OtpPurpose, string> = {
  verify_phone: "o teu código de verificação",
  verify_email: "o teu código de verificação de email",
  reset_password: "o código para recuperar a palavra-passe",
  login_2fa: "o código de entrada",
  change_contact: "o código para confirmar o novo contacto",
  withdrawal: "o código para confirmar o levantamento",
  enable_2fa: "o código para ativar a verificação em dois passos",
  delete_account: "o código para eliminar a conta",
};

/** Cria e envia um código de 6 dígitos (SMS para telefones, email para emails). Devolve o código só para DEV_EXPOSE_OTP/testes. */
export async function sendOtp(ctx: Ctx, input: { target: string; purpose: OtpPurpose; userId?: string | null; data?: Record<string, unknown> }) {
  const now = ctx.now();
  const last = await ctx.db.query.otpCodes.findFirst({
    where: and(eq(schema.otpCodes.target, input.target), eq(schema.otpCodes.purpose, input.purpose)),
    orderBy: desc(schema.otpCodes.createdAt),
  });
  if (last && now.getTime() - last.createdAt.getTime() < COOLDOWN_MS) throw tooMany("Espera um minuto antes de pedir outro código.");
  const code = numericCode(6);
  await ctx.db.insert(schema.otpCodes).values({
    id: uuid(), userId: input.userId ?? null, target: input.target, purpose: input.purpose, codeHash: sha256(`${input.target}:${code}`),
    data: input.data ?? null, expiresAt: new Date(now.getTime() + TTL_MS), createdAt: now,
  });
  const msg = `Fedha Live: ${code} é ${TEXT[input.purpose]}. Válido 10 minutos. Não partilhes este código.`;
  if (input.target.includes("@")) await ctx.messenger.email(input.target, "O teu código Fedha Live", msg);
  else await ctx.messenger.sms(input.target, msg);
  return ctx.env.DEV_EXPOSE_OTP || ctx.env.NODE_ENV === "test" ? code : undefined;
}

/** Valida e consome o código. Bloqueia ao fim de 5 tentativas erradas. */
export async function consumeOtp(ctx: Ctx, target: string, purpose: OtpPurpose, code: string) {
  const now = ctx.now();
  const row = await ctx.db.query.otpCodes.findFirst({
    where: and(eq(schema.otpCodes.target, target), eq(schema.otpCodes.purpose, purpose), isNull(schema.otpCodes.consumedAt), gt(schema.otpCodes.expiresAt, now)),
    orderBy: desc(schema.otpCodes.createdAt),
  });
  if (!row) throw badRequest("otp_invalid", "Código inválido ou expirado. Pede um novo.", { field: "code" });
  if (row.attempts >= MAX_ATTEMPTS) throw tooMany("Demasiadas tentativas com este código. Pede um novo.");
  if (row.codeHash !== sha256(`${target}:${code.trim()}`)) {
    await ctx.db.update(schema.otpCodes).set({ attempts: row.attempts + 1 }).where(eq(schema.otpCodes.id, row.id));
    throw badRequest("otp_invalid", "Código errado.", { field: "code" });
  }
  await ctx.db.update(schema.otpCodes).set({ consumedAt: now }).where(eq(schema.otpCodes.id, row.id));
  return row;
}
