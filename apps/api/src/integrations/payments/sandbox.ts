import { hmacSha256, safeEqual } from "../../shared/security/crypto";
import { numericCode, uuid } from "../../shared/security/ids";
import type { CreateChargeInput, CreateChargeResult, GatewayStatus, PaymentGateway, StatementLine, WebhookEvent } from "./gateway";

interface Charge {
  input: CreateChargeInput;
  ref: string;
  status: GatewayStatus;
  paidAt?: Date;
}

/**
 * Gateway simulado para desenvolvimento e testes. Comporta-se como um agregador real:
 * cria cobranças, envia webhooks assinados (HMAC-SHA256 no cabeçalho x-signature) e devolve extratos.
 *
 * Números de teste (Multicaixa Express, Unitel Money, Afrimoney):
 * - termina em 000 → recusado
 * - termina em 999 → fica pendente até expirar
 * - qualquer outro → confirmado ao fim de SANDBOX_AUTO_CONFIRM_MS
 * Referência e cartão: só confirmam com POST /v1/sandbox/payments/:id/confirm.
 */
export class SandboxGateway implements PaymentGateway {
  readonly name = "sandbox";
  private charges = new Map<string, Charge>();
  /** Entrega um webhook à própria API. Ligado em app.ts. */
  deliver: (headers: Record<string, string>, rawBody: string) => Promise<void> = async () => {};

  constructor(private secret: string, private autoConfirmMs: number) {}

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const ref = `SBX-${uuid().slice(0, 8)}`;
    const charge: Charge = { input, ref, status: "pending" };
    this.charges.set(ref, charge);
    const phone = input.phone ?? "";
    if (input.method === "reference") {
      return { providerRef: ref, status: "pending", referenceEntity: "11333", referenceNumber: numericCode(9) };
    }
    if (input.method === "card") {
      return { providerRef: ref, status: "pending", redirectUrl: `${input.returnUrl}?sandbox_card=${input.paymentId}` };
    }
    if (phone.endsWith("000")) {
      charge.status = "declined";
      return { providerRef: ref, status: "declined", failureReason: "Pagamento recusado na app." };
    }
    if (!phone.endsWith("999") && this.autoConfirmMs > 0) {
      setTimeout(() => void this.settle(ref, "confirmed"), this.autoConfirmMs).unref();
    }
    return { providerRef: ref, status: "pending" };
  }

  /** Simula a decisão do banco e envia o webhook. */
  async settle(ref: string, status: "confirmed" | "declined") {
    const c = this.charges.get(ref);
    if (!c || c.status !== "pending") return false;
    c.status = status;
    if (status === "confirmed") c.paidAt = new Date();
    const body = JSON.stringify({ id: uuid(), type: "payment", ref, paymentId: c.input.paymentId, status, amount: c.input.amount });
    await this.deliver({ "x-signature": hmacSha256(this.secret, body), "content-type": "application/json" }, body);
    return true;
  }

  async settleByPaymentId(paymentId: string, status: "confirmed" | "declined") {
    const c = [...this.charges.values()].find((x) => x.input.paymentId === paymentId);
    return c ? this.settle(c.ref, status) : false;
  }

  async getStatus(ref: string) {
    const c = this.charges.get(ref);
    return { status: c?.status ?? ("error" as GatewayStatus), amount: c?.input.amount };
  }

  async refund() {
    return { status: "refunded" as const, providerRef: `SBX-RF-${uuid().slice(0, 8)}` };
  }

  verifyWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string) {
    const sig = headers["x-signature"];
    return typeof sig === "string" && safeEqual(sig, hmacSha256(this.secret, rawBody));
  }

  parseWebhook(body: unknown): WebhookEvent {
    const b = body as { id: string; type: "payment"; ref: string; paymentId: string; status: GatewayStatus; amount: number };
    return { eventId: b.id, type: b.type, providerRef: b.ref, paymentId: b.paymentId, status: b.status, amount: b.amount, raw: body };
  }

  async statement(day: string): Promise<StatementLine[]> {
    return [...this.charges.values()]
      .filter((c) => c.status === "confirmed" && c.paidAt && luandaDay(c.paidAt) === day)
      .map((c) => ({ providerRef: c.ref, paymentId: c.input.paymentId, amount: c.input.amount, paidAt: c.paidAt! }));
  }

  /** Só testes: injeta uma linha de extrato sem pedido. */
  injectStatementLine(ref: string, amount: number, paidAt = new Date()) {
    this.charges.set(ref, {
      ref, status: "confirmed", paidAt,
      input: { paymentId: "", orderId: "", method: "mcx", amount, expiresAt: paidAt, description: "", returnUrl: "" },
    });
  }
}

export const luandaDay = (d: Date) => new Date(d.getTime() + 3600_000).toISOString().slice(0, 10);
