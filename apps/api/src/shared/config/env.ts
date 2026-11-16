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
  /** Origem onde abrem os widgets (/o/<token>). Os widgets vivem no próprio site (RN-WID-01). */
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
  /** SMS: "ombala" (fornecedor angolano, o mesmo do MUTH e do UOR Connect), "http" (outro gateway) ou "console" (só log). */
  SMS_PROVIDER: z.enum(["console", "ombala", "http"]).default("console"),
  /** Remetente aprovado no fornecedor (até 11 caracteres). */
  SMS_SENDER: z.string().max(11).default("FEDHA"),
  OMBALA_API_URL: z.string().url().default("https://api.useombala.ao"),
  OMBALA_API_TOKEN: z.string().optional(),
  SMS_HTTP_URL: z.string().optional(),
  SMS_HTTP_TOKEN: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Fedha Live <nao-responder@fedha.live>"),
  /** WhatsApp: "evolution" (Evolution API self-hosted, como no UOR Connect), "meta" (Cloud API oficial) ou "console". */
  WHATSAPP_PROVIDER: z.enum(["console", "evolution", "meta"]).default("console"),
  EVOLUTION_API_URL: z.string().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  /** Nome da instância (o número ligado por QR code) na Evolution API. */
  EVOLUTION_INSTANCE: z.string().default("fedha"),
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
    // Os códigos de verificação (RN-CON-02) só chegam às pessoas com um fornecedor de SMS real.
    if (env.SMS_PROVIDER === "console") throw new Error("SMS_PROVIDER=console não envia SMS: escolhe ombala ou http em produção");
    if (env.SMS_PROVIDER === "ombala" && !env.OMBALA_API_TOKEN) throw new Error("OMBALA_API_TOKEN tem de ser definido com SMS_PROVIDER=ombala");
    if (env.SMS_PROVIDER === "http" && !env.SMS_HTTP_URL) throw new Error("SMS_HTTP_URL tem de ser definido com SMS_PROVIDER=http");
    if (env.WHATSAPP_PROVIDER === "evolution" && !(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY)) throw new Error("EVOLUTION_API_URL e EVOLUTION_API_KEY têm de ser definidos com WHATSAPP_PROVIDER=evolution");
    if (env.WHATSAPP_PROVIDER === "meta" && !(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID)) throw new Error("WHATSAPP_TOKEN e WHATSAPP_PHONE_ID têm de ser definidos com WHATSAPP_PROVIDER=meta");
  }
  return env;
}
