import { getJson, postJson, MessagingError, type FetchLike } from "../messaging/http";
import { parsePhone } from "../messaging/phone";

export interface WhatsAppProvider {
  readonly name: string;
  missing(): string[];
  send(to: string, text: string): Promise<{ id?: string }>;
}

export class ConsoleWhatsApp implements WhatsAppProvider {
  readonly name = "console";
  constructor(private log: { info: (o: unknown, m: string) => void }) {}
  missing() { return []; }
  async send(to: string, text: string) {
    this.log.info({ to, text }, "[whatsapp]");
    return {};
  }
}

/**
 * Evolution API v2 (self-hosted, a mesma abordagem do UOR Connect): um número de WhatsApp ligado por QR code
 * a uma "instância". POST {base}/message/sendText/{instância} com o cabeçalho apikey e {number, text};
 * "number" é 2449XXXXXXXX. Arranque e emparelhamento: infra/evolution/README.md.
 */
export class EvolutionWhatsApp implements WhatsAppProvider {
  readonly name = "evolution";
  constructor(private cfg: { baseUrl?: string; apiKey?: string; instance?: string; fetch?: FetchLike }) {}

  missing() {
    const m: string[] = [];
    if (!this.cfg.baseUrl) m.push("EVOLUTION_API_URL");
    if (!this.cfg.apiKey) m.push("EVOLUTION_API_KEY");
    if (!this.cfg.instance) m.push("EVOLUTION_INSTANCE");
    return m;
  }

  private ready() {
    const m = this.missing();
    if (m.length) throw new MessagingError("evolution", `falta configurar ${m.join(", ")}`);
    return { base: this.cfg.baseUrl!.replace(/\/+$/, ""), headers: { apikey: this.cfg.apiKey! }, instance: encodeURIComponent(this.cfg.instance!) };
  }

  async send(to: string, text: string) {
    const { base, headers, instance } = this.ready();
    const res = await postJson("evolution", `${base}/message/sendText/${instance}`, headers, { number: parsePhone(to).intl, text }, { fetch: this.cfg.fetch });
    const key = (res.body as { key?: { id?: string } } | null)?.key;
    return { id: key?.id };
  }

  /** Cria a instância (uma vez) e devolve o QR code para ligar o número. */
  async createInstance() {
    const { base, headers } = this.ready();
    return (await postJson("evolution", `${base}/instance/create`, headers, {
      instanceName: this.cfg.instance, integration: "WHATSAPP-BAILEYS", qrcode: true,
      rejectCall: true, groupsIgnore: true, alwaysOnline: false, readMessages: false,
    }, { fetch: this.cfg.fetch, attempts: 1 })).body;
  }

  /** Pede um QR code novo para uma instância já criada. */
  async connect() {
    const { base, headers, instance } = this.ready();
    return (await getJson("evolution", `${base}/instance/connect/${instance}`, headers, { fetch: this.cfg.fetch })).body;
  }

  /** Estado da ligação do número (open = pronto a enviar). */
  async connectionState() {
    const { base, headers, instance } = this.ready();
    return (await getJson("evolution", `${base}/instance/connectionState/${instance}`, headers, { fetch: this.cfg.fetch })).body;
  }
}

/**
 * WhatsApp Cloud API da Meta (alternativa oficial). Fora da janela de 24 h só aceita modelos aprovados;
 * texto livre serve para responder a quem escreveu primeiro.
 */
export class MetaWhatsApp implements WhatsAppProvider {
  readonly name = "meta";
  constructor(private cfg: { token?: string; phoneId?: string; fetch?: FetchLike }) {}
  missing() {
    const m: string[] = [];
    if (!this.cfg.token) m.push("WHATSAPP_TOKEN");
    if (!this.cfg.phoneId) m.push("WHATSAPP_PHONE_ID");
    return m;
  }
  async send(to: string, text: string) {
    const m = this.missing();
    if (m.length) throw new MessagingError("meta", `falta configurar ${m.join(", ")}`);
    const res = await postJson("meta", `https://graph.facebook.com/v20.0/${this.cfg.phoneId}/messages`, { Authorization: `Bearer ${this.cfg.token}` },
      { messaging_product: "whatsapp", to: parsePhone(to).intl, type: "text", text: { body: text } }, { fetch: this.cfg.fetch });
    const id = (res.body as { messages?: { id?: string }[] } | null)?.messages?.[0]?.id;
    return { id };
  }
}
