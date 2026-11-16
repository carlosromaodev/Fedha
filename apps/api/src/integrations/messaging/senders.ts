import { ConsoleSms, HttpSms, OmbalaSms, type SmsProvider } from "../sms/sms";
import { ConsoleWhatsApp, EvolutionWhatsApp, MetaWhatsApp, type WhatsAppProvider } from "../whatsapp/whatsapp";
import type { FetchLike } from "./http";
import { mask } from "./phone";

export type Channel = "sms" | "email" | "whatsapp" | "push";

export interface OutboxItem {
  channel: Channel;
  to: string;
  subject?: string;
  text: string;
  at: Date;
}

export interface Messenger {
  sms(to: string, text: string): Promise<void>;
  email(to: string, subject: string, text: string): Promise<void>;
  whatsapp(to: string, text: string): Promise<void>;
}

export interface MessengerCfg {
  NODE_ENV: "development" | "test" | "production";
  SMS_PROVIDER: "console" | "ombala" | "http";
  SMS_SENDER: string;
  OMBALA_API_URL: string;
  OMBALA_API_TOKEN?: string;
  SMS_HTTP_URL?: string;
  SMS_HTTP_TOKEN?: string;
  EMAIL_PROVIDER: "console" | "resend";
  RESEND_API_KEY?: string;
  EMAIL_FROM: string;
  WHATSAPP_PROVIDER: "console" | "evolution" | "meta";
  EVOLUTION_API_URL?: string;
  EVOLUTION_API_KEY?: string;
  EVOLUTION_INSTANCE?: string;
  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_ID?: string;
}

type Log = { info: (o: unknown, m: string) => void; warn?: (o: unknown, m: string) => void };

export function buildSmsProvider(cfg: MessengerCfg, log: Log, fetch?: FetchLike): SmsProvider {
  if (cfg.SMS_PROVIDER === "ombala") return new OmbalaSms({ baseUrl: cfg.OMBALA_API_URL, token: cfg.OMBALA_API_TOKEN, sender: cfg.SMS_SENDER, fetch });
  if (cfg.SMS_PROVIDER === "http") return new HttpSms({ url: cfg.SMS_HTTP_URL, token: cfg.SMS_HTTP_TOKEN, sender: cfg.SMS_SENDER, fetch });
  return new ConsoleSms(log);
}

export function buildWhatsAppProvider(cfg: MessengerCfg, log: Log, fetch?: FetchLike): WhatsAppProvider {
  if (cfg.WHATSAPP_PROVIDER === "evolution") return new EvolutionWhatsApp({ baseUrl: cfg.EVOLUTION_API_URL, apiKey: cfg.EVOLUTION_API_KEY, instance: cfg.EVOLUTION_INSTANCE, fetch });
  if (cfg.WHATSAPP_PROVIDER === "meta") return new MetaWhatsApp({ token: cfg.WHATSAPP_TOKEN, phoneId: cfg.WHATSAPP_PHONE_ID, fetch });
  return new ConsoleWhatsApp(log);
}

/**
 * Envia SMS, email e WhatsApp pelo fornecedor escolhido no .env (SMS_PROVIDER, WHATSAPP_PROVIDER, EMAIL_PROVIDER).
 * Um envio falhado lança erro: quem chama decide se o utilizador tem de saber (OTP) ou se basta registar (avisos).
 * A caixa de saída em memória só existe fora de produção (testes e DEV_EXPOSE_OTP); em produção não guardamos códigos.
 */
export class DefaultMessenger implements Messenger {
  readonly outbox: OutboxItem[] = [];
  readonly smsProvider: SmsProvider;
  readonly whatsappProvider: WhatsAppProvider;

  constructor(private cfg: MessengerCfg, private log: Log, opts: { fetch?: FetchLike } = {}) {
    this.smsProvider = buildSmsProvider(cfg, log, opts.fetch);
    this.whatsappProvider = buildWhatsAppProvider(cfg, log, opts.fetch);
  }

  private record(item: Omit<OutboxItem, "at">) {
    if (this.cfg.NODE_ENV === "production") return;
    this.outbox.push({ ...item, at: new Date() });
    if (this.outbox.length > 500) this.outbox.shift();
  }

  /** Fornecedores ativos e o que falta configurar (diagnóstico e arranque). */
  status() {
    return {
      sms: { provider: this.smsProvider.name, missing: this.smsProvider.missing() },
      whatsapp: { provider: this.whatsappProvider.name, missing: this.whatsappProvider.missing() },
      email: { provider: this.cfg.EMAIL_PROVIDER, missing: this.cfg.EMAIL_PROVIDER === "resend" && !this.cfg.RESEND_API_KEY ? ["RESEND_API_KEY"] : [] },
    };
  }

  async sms(to: string, text: string) {
    this.record({ channel: "sms", to, text });
    const { id } = await this.smsProvider.send(to, text);
    if (this.smsProvider.name !== "console") this.log.info({ provider: this.smsProvider.name, to: mask(to), id }, "sms enviado");
  }

  async email(to: string, subject: string, text: string) {
    this.record({ channel: "email", to, subject, text });
    if (this.cfg.EMAIL_PROVIDER === "resend" && this.cfg.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.RESEND_API_KEY}` },
        body: JSON.stringify({ from: this.cfg.EMAIL_FROM, to, subject, text }),
      });
      if (!res.ok) throw new Error(`Email falhou: ${res.status}`);
      return;
    }
    this.log.info({ to, subject, text }, "[email]");
  }

  async whatsapp(to: string, text: string) {
    this.record({ channel: "whatsapp", to, text });
    const { id } = await this.whatsappProvider.send(to, text);
    if (this.whatsappProvider.name !== "console") this.log.info({ provider: this.whatsappProvider.name, to: mask(to), id }, "whatsapp enviado");
  }

  /** Último código enviado para um destino (testes e DEV_EXPOSE_OTP). */
  lastTo(to: string) {
    return [...this.outbox].reverse().find((o) => o.to === to);
  }
}
