import { z } from "zod";
import { AoPhone, Handle, IsoDate } from "./common";

export const Password = z
  .string()
  .min(8, "A palavra-passe tem de ter pelo menos 8 caracteres.")
  .max(128)
  .regex(/[A-Za-z]/, "Usa pelo menos uma letra.")
  .regex(/\d/, "Usa pelo menos um número.");

export const RegisterBody = z.object({
  displayName: z.string().trim().min(2).max(40),
  handle: Handle,
  email: z.string().trim().toLowerCase().email(),
  phone: AoPhone,
  password: Password,
  /** AAAA-MM-DD. Menores de 18 não podem criar conta de streamer. */
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Tens de aceitar os termos." }) }),
});
export type RegisterBody = z.infer<typeof RegisterBody>;

export const Role = z.enum(["streamer", "assistant", "admin"]);
export const AdminRole = z.enum(["super_admin", "operations", "finance", "compliance"]);
export type AdminRole = z.infer<typeof AdminRole>;

export const Me = z.object({
  id: z.string(),
  role: Role,
  adminRole: AdminRole.nullable(),
  displayName: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  twoFactor: z.enum(["totp", "sms"]).nullable(),
  streamer: z.object({ id: z.string(), handle: z.string(), kycStatus: z.string(), onboardingCompleted: z.boolean() }).nullable(),
  createdAt: IsoDate,
});
export type Me = z.infer<typeof Me>;

export const Tokens = z.object({ accessToken: z.string(), refreshToken: z.string(), expiresIn: z.number().int() });
export type Tokens = z.infer<typeof Tokens>;

export const AuthResult = z.union([
  Tokens.extend({ user: Me }),
  z.object({ twoFactorRequired: z.literal(true), challengeToken: z.string(), method: z.enum(["totp", "sms"]) }),
]);
export type AuthResult = z.infer<typeof AuthResult>;

export const LoginBody = z.object({ identifier: z.string().trim().min(3), password: z.string().min(1) });
export const TwoFactorVerifyBody = z.object({ challengeToken: z.string(), code: z.string().trim().min(6).max(20) });
export const VerifyCodeBody = z.object({ code: z.string().trim().length(6) });
export const VerifyEmailBody = z.object({ code: z.string().trim().length(6) });
export const ResendOtpBody = z.object({ channel: z.enum(["sms", "email"]) });
export const RefreshBody = z.object({ refreshToken: z.string() });
export const ForgotPasswordBody = z.object({ identifier: z.string().trim(), channel: z.enum(["sms", "email"]).default("sms") });
export const ResetPasswordBody = z.object({ identifier: z.string().trim(), code: z.string().trim().length(6), newPassword: Password });

export const UpdateMeBody = z.object({ displayName: z.string().trim().min(2).max(40).optional() });
export const ChangePasswordBody = z.object({ currentPassword: z.string(), newPassword: Password });
export const ChangeContactBody = z.object({ email: z.string().trim().toLowerCase().email().optional(), phone: AoPhone.optional() })
  .refine((b) => !!b.email !== !!b.phone, "Indica só o email ou só o telefone.");
export const ConfirmContactBody = z.object({ code: z.string().trim().length(6) });
export const DeleteAccountBody = z.object({ password: z.string(), code: z.string().optional() });

export const TotpSetupResponse = z.object({ secret: z.string(), otpauthUrl: z.string() });
export const Enable2faBody = z.object({ method: z.enum(["totp", "sms"]), code: z.string().trim().length(6) });
export const Disable2faBody = z.object({ code: z.string().trim().min(6), password: z.string() });
export const RecoveryCodesResponse = z.object({ recoveryCodes: z.array(z.string()) });

export const SessionView = z.object({ id: z.string(), userAgent: z.string().nullable(), ip: z.string().nullable(), createdAt: IsoDate, lastUsedAt: IsoDate, current: z.boolean() });
