import { z } from "zod";

const bool = z.union([z.boolean(), z.string()]).transform((v) => v === true || v === "true" || v === "1");

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3333),
  HOST: z.string().default("0.0.0.0"),
  /** URL pública da API (links de áudio e webhooks). */
  PUBLIC_API_URL: z.string().default("http://localhost:3333"),
  /** URL pública do site (página do doador, overlay, Player). */
  PUBLIC_WEB_URL: z.string().default("http://localhost:5173"),
  /** URL pública do overlay (apps/overlay). Por omissão igual ao site. */
  PUBLIC_OVERLAY_URL: z.string().optional(),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:5174"),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16).default("dev-secret-troca-isto-em-producao"),
  /** 32 bytes em hex para cifrar documentos KYC e segredos 2FA. */
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i).default("0".repeat(64)),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  STORAGE_DIR: z.string().default("./.data/storage"),
  JOBS_ENABLED: bool.default(true),
  SEED_DEMO: bool.default(false),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  /** Mostra os códigos OTP na resposta (só desenvolvimento, nunca em produção). */
  DEV_EXPOSE_OTP: bool.default(false),

  // Pagamentos
  /** Fornecedor por método. "sandbox" simula tudo sem credenciais. */
  PAYMENTS_MCX_PROVIDER: z.enum(["sandbox", "appypay", "emis"]).default("sandbox"),
  PAYMENTS_REFERENCE_PROVIDER: z.enum(["sandbox", "proxypay", "appypay"]).default("sandbox"),
  PAYMENTS_WALLET_PROVIDER: z.enum(["sandbox", "appypay"]).default("sandbox"),
  PAYMENTS_CARD_PROVIDER: z.enum(["sandbox", "appypay"]).default("sandbox"),
  PROXYPAY_ENTITY: z.string().optional(),
  /** Sandbox: confirma o Multicaixa Express sozinho ao fim de N ms (0 = só manual). */
  SANDBOX_AUTO_CONFIRM_MS: z.coerce.number().default(5000),
  SANDBOX_WEBHOOK_SECRET: z.string().default("sandbox-webhook-secret"),
  PROXYPAY_API_KEY: z.string().optional(),
  PROXYPAY_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  APPYPAY_CLIENT_ID: z.string().optional(),
  APPYPAY_CLIENT_SECRET: z.string().optional(),
  APPYPAY_BASE_URL: z.string().optional(),
  APPYPAY_WEBHOOK_SECRET: z.string().optional(),
  EMIS_GPO_TOKEN: z.string().optional(),
  EMIS_GPO_BASE_URL: z.string().optional(),

  // TTS
  TTS_PROVIDER: z.enum(["mock", "azure"]).default("mock"),
  AZURE_TTS_KEY: z.string().optional(),
  AZURE_TTS_REGION: z.string().optional(),

  // Mensagens
  SMS_PROVIDER: z.enum(["console", "http"]).default("console"),
  SMS_HTTP_URL: z.string().optional(),
  SMS_HTTP_TOKEN: z.string().optional(),
  SMS_SENDER: z.string().default("FEDHA"),
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Fedha Live <nao-responder@fedha.live>"),
  WHATSAPP_PROVIDER: z.enum(["console", "meta"]).default("console"),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_ID: z.string().optional(),
});

export type Env = z.infer<typeof Env>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const env = Env.parse(source);
  if (env.NODE_ENV === "production") {
    if (env.JWT_SECRET.startsWith("dev-")) throw new Error("JWT_SECRET tem de ser definido em produção");
    if (/^0+$/.test(env.ENCRYPTION_KEY)) throw new Error("ENCRYPTION_KEY tem de ser definido em produção");
    if (env.DEV_EXPOSE_OTP) throw new Error("DEV_EXPOSE_OTP não pode estar ligado em produção");
  }
  return env;
}
