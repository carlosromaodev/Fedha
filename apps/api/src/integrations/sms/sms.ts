import { getJson, postJson, MessagingError, type FetchLike } from "../messaging/http";
import { parsePhone } from "../messaging/phone";

export interface SmsProvider {
  readonly name: string;
  /** Falta configuração? Lista as variáveis em falta (vazio = pronto). */
  missing(): string[];
  send(to: string, text: string): Promise<{ id?: string }>;
}

/** Escreve no log. Só para desenvolvimento e testes. */
export class ConsoleSms implements SmsProvider {
  readonly name = "console";
  constructor(private log: { info: (o: unknown, m: string) => void }) {}
  missing() { return []; }
  async send(to: string, text: string) {
    this.log.info({ to, text }, "[sms]");
    return {};
  }
}

/**
 * Ombala (https://useombala.ao), o mesmo fornecedor do MUTH e do UOR Connect.
 * POST {base}/v1/messages com Authorization: Token <token> e {message, from, to}; "to" é 9XXXXXXXX.
 * O remetente ("from") tem de estar aprovado na conta Ombala (até 11 caracteres).
 */
export class OmbalaSms implements SmsProvider {
  readonly name = "ombala";
  constructor(private cfg: { baseUrl: string; token?: string; sender: string; fetch?: FetchLike }) {}

  missing() {
    const m: string[] = [];
    if (!this.cfg.token) m.push("OMBALA_API_TOKEN");
    if (!this.cfg.sender) m.push("SMS_SENDER");
    return m;
  }

  private get base() { return this.cfg.baseUrl.replace(/\/+$/, ""); }
  private headers() {
    if (!this.cfg.token) throw new MessagingError("ombala", "OMBALA_API_TOKEN não configurado");
    return { Authorization: `Token ${this.cfg.token}` };
  }

  async send(to: string, text: string) {
    const phone = parsePhone(to);
    // A Ombala só envia para Angola.
    if (!phone.angolan) throw new MessagingError("ombala", "só envia para números angolanos");
    const res = await postJson("ombala", `${this.base}/v1/messages`, this.headers(), { message: text, from: this.cfg.sender, to: phone.national }, { fetch: this.cfg.fetch });
    return { id: pickId(res.body) };
  }

  /** Saldo de SMS (diagnóstico: pnpm --filter @fedha/api messaging:check). */
  async credits() {
    return (await getJson("ombala", `${this.base}/v1/credits`, this.headers(), { fetch: this.cfg.fetch })).body;
  }

  async approvedSenders() {
    return (await getJson("ombala", `${this.base}/v1/senders/approved`, this.headers(), { fetch: this.cfg.fetch })).body;
  }
}

/**
 * Qualquer outro gateway HTTP: POST JSON {to, from, text} com Authorization: Bearer <token>.
 * "to" vai em +2449XXXXXXXX.
 */
export class HttpSms implements SmsProvider {
  readonly name = "http";
  constructor(private cfg: { url?: string; token?: string; sender: string; fetch?: FetchLike }) {}
  missing() { return this.cfg.url ? [] : ["SMS_HTTP_URL"]; }
  async send(to: string, text: string) {
    if (!this.cfg.url) throw new MessagingError("http", "SMS_HTTP_URL não configurado");
    const headers: Record<string, string> = this.cfg.token ? { Authorization: `Bearer ${this.cfg.token}` } : {};
    const res = await postJson("sms-http", this.cfg.url, headers, { to: parsePhone(to).e164, from: this.cfg.sender, text }, { fetch: this.cfg.fetch });
    return { id: pickId(res.body) };
  }
}

function pickId(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  const data = (b.data && typeof b.data === "object" ? b.data : {}) as Record<string, unknown>;
  const id = b.id ?? b.message_id ?? data.id ?? data.message_id;
  return typeof id === "string" || typeof id === "number" ? String(id) : undefined;
}
