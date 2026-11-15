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

interface Cfg {
  SMS_PROVIDER: "console" | "http";
  SMS_HTTP_URL?: string;
  SMS_HTTP_TOKEN?: string;
  SMS_SENDER: string;
  EMAIL_PROVIDER: "console" | "resend";
  RESEND_API_KEY?: string;
  EMAIL_FROM: string;
  WHATSAPP_PROVIDER: "console" | "meta";
  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_ID?: string;
}

/**
 * Envia SMS, email e WhatsApp. Em "console" escreve no log e guarda na caixa de saída (útil em testes).
 * SMS "http": gateway genérico (POST JSON {to, from, text} com Bearer), para ligar a um fornecedor angolano.
 */
export class DefaultMessenger implements Messenger {
  readonly outbox: OutboxItem[] = [];
  constructor(private cfg: Cfg, private log: { info: (o: unknown, m: string) => void }) {}

  private record(item: Omit<OutboxItem, "at">) {
    this.outbox.push({ ...item, at: new Date() });
    if (this.outbox.length > 500) this.outbox.shift();
  }

  async sms(to: string, text: string) {
    this.record({ channel: "sms", to, text });
    if (this.cfg.SMS_PROVIDER === "http" && this.cfg.SMS_HTTP_URL) {
      const res = await fetch(this.cfg.SMS_HTTP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.SMS_HTTP_TOKEN ?? ""}` },
        body: JSON.stringify({ to, from: this.cfg.SMS_SENDER, text }),
      });
      if (!res.ok) throw new Error(`SMS falhou: ${res.status}`);
      return;
    }
    this.log.info({ to, text }, "[sms]");
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
    if (this.cfg.WHATSAPP_PROVIDER === "meta" && this.cfg.WHATSAPP_TOKEN && this.cfg.WHATSAPP_PHONE_ID) {
      const res = await fetch(`https://graph.facebook.com/v20.0/${this.cfg.WHATSAPP_PHONE_ID}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.WHATSAPP_TOKEN}` },
        body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/^\+/, ""), type: "text", text: { body: text } }),
      });
      if (!res.ok) throw new Error(`WhatsApp falhou: ${res.status}`);
      return;
    }
    this.log.info({ to, text }, "[whatsapp]");
  }

  /** Último código enviado para um destino (testes e DEV_EXPOSE_OTP). */
  lastTo(to: string) {
    return [...this.outbox].reverse().find((o) => o.to === to);
  }
}
