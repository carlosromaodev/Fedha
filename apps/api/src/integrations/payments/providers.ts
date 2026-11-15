import { hmacSha256, safeEqual } from "../../shared/security/crypto";
import {
  ProviderNotConfiguredError,
  type CreateChargeInput, type CreateChargeResult, type PaymentGateway, type StatementLine, type WebhookEvent,
} from "./gateway";

/**
 * ProxyPay (Referência Multicaixa). API v2: https://developer.proxypay.co.ao
 * Implementado a partir da documentação pública, ainda não testado com credenciais reais.
 * - Gera o número em POST /reference_ids e cria a referência em PUT /references/{id}.
 * - Pagamentos chegam por webhook com X-Signature = HMAC-SHA256(api_key, corpo).
 * - Reembolsos: a ProxyPay não reembolsa referências → reembolso manual por Multicaixa Express.
 */
export class ProxyPayGateway implements PaymentGateway {
  readonly name = "proxypay";
  private base: string;
  constructor(private apiKey: string | undefined, env: "sandbox" | "production", private entity: string | undefined) {
    this.base = env === "production" ? "https://api.proxypay.co.ao" : "https://api.sandbox.proxypay.co.ao";
  }
  private headers() {
    if (!this.apiKey) throw new ProviderNotConfiguredError("proxypay", ["PROXYPAY_API_KEY"]);
    return { Authorization: `Token ${this.apiKey}`, Accept: "application/vnd.proxypay.v2+json", "Content-Type": "application/json" };
  }
  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    if (input.method !== "reference") throw new Error("ProxyPay só suporta Referência Multicaixa");
    const idRes = await fetch(`${this.base}/reference_ids`, { method: "POST", headers: this.headers() });
    if (!idRes.ok) throw new Error(`ProxyPay reference_ids ${idRes.status}`);
    const refId = String(await idRes.json());
    const res = await fetch(`${this.base}/references/${refId}`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({
        amount: input.amount.toFixed(2),
        end_datetime: input.expiresAt.toISOString().slice(0, 19),
        custom_fields: { payment_id: input.paymentId, order_id: input.orderId },
      }),
    });
    if (!res.ok) throw new Error(`ProxyPay references ${res.status}`);
    return { providerRef: refId, status: "pending", referenceEntity: this.entity ?? "", referenceNumber: refId };
  }
  async getStatus() {
    // A ProxyPay não expõe consulta por referência paga; depende do webhook e de GET /payments.
    return { status: "pending" as const };
  }
  async refund() {
    return { status: "manual" as const };
  }
  verifyWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string) {
    const sig = headers["x-signature"];
    return !!this.apiKey && typeof sig === "string" && safeEqual(sig, hmacSha256(this.apiKey, rawBody));
  }
  parseWebhook(body: unknown): WebhookEvent {
    const b = body as { id: number | string; reference_id: number | string; amount: string; custom_fields?: { payment_id?: string } };
    return {
      eventId: String(b.id),
      type: "payment",
      providerRef: String(b.reference_id),
      paymentId: b.custom_fields?.payment_id,
      status: "confirmed",
      amount: Math.round(Number(b.amount)),
      raw: body,
    };
  }
  async statement(): Promise<StatementLine[]> {
    // GET /payments devolve os pagamentos ainda não confirmados (ack) pelo comerciante.
    const res = await fetch(`${this.base}/payments`, { headers: this.headers() });
    if (!res.ok) throw new Error(`ProxyPay payments ${res.status}`);
    const list = (await res.json()) as Array<{ reference_id: number; amount: string; datetime: string; custom_fields?: { payment_id?: string } }>;
    return list.map((p) => ({
      providerRef: String(p.reference_id), paymentId: p.custom_fields?.payment_id, amount: Math.round(Number(p.amount)), paidAt: new Date(p.datetime),
    }));
  }
}

/**
 * Adaptador para agregadores com Multicaixa Express (AppyPay, EMIS GPO direto) e carteiras móveis.
 * Falta a documentação técnica e as credenciais do parceiro escolhido: a forma dos pedidos está por confirmar.
 * Mantém a interface para que a troca do sandbox pelo fornecedor real não mexa no resto do sistema.
 */
export class PendingContractGateway implements PaymentGateway {
  constructor(readonly name: string, private missing: string[]) {}
  private fail(): never {
    throw new ProviderNotConfiguredError(this.name, this.missing);
  }
  createCharge(): Promise<CreateChargeResult> { return Promise.resolve().then(() => this.fail()); }
  getStatus(): Promise<{ status: "error" }> { return Promise.resolve().then(() => this.fail()); }
  refund(): Promise<{ status: "manual" }> { return Promise.resolve({ status: "manual" }); }
  verifyWebhook() { return false; }
  parseWebhook(): WebhookEvent { return this.fail(); }
  statement(): Promise<StatementLine[]> { return Promise.resolve().then(() => this.fail()); }
}
