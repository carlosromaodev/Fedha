export type PaymentMethod = "mcx" | "reference" | "unitel_money" | "afrimoney" | "card";
export type GatewayStatus = "pending" | "confirmed" | "declined" | "expired" | "error";

export interface CreateChargeInput {
  paymentId: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  phone?: string | null;
  expiresAt: Date;
  description: string;
  returnUrl: string;
}

export interface CreateChargeResult {
  providerRef: string;
  status: GatewayStatus;
  referenceEntity?: string;
  referenceNumber?: string;
  redirectUrl?: string;
  failureReason?: string;
  raw?: unknown;
}

export interface WebhookEvent {
  eventId: string;
  type: "payment" | "refund";
  providerRef?: string;
  paymentId?: string;
  status: GatewayStatus | "refunded" | "refund_failed";
  amount?: number;
  raw: unknown;
}

export interface StatementLine {
  providerRef: string;
  paymentId?: string;
  amount: number;
  paidAt: Date;
}

export interface RefundResult {
  status: "refunded" | "processing" | "manual";
  providerRef?: string;
}

export interface PaymentGateway {
  readonly name: string;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  getStatus(providerRef: string): Promise<{ status: GatewayStatus; amount?: number }>;
  /** Reembolso pelo mesmo método. "manual" = o gateway não suporta; a equipa paga por Multicaixa Express. */
  refund(input: { paymentId: string; providerRef: string; amount: number; phone?: string | null }): Promise<RefundResult>;
  verifyWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): boolean;
  parseWebhook(body: unknown): WebhookEvent;
  /** Extrato do dia (AAAA-MM-DD, Luanda) para a reconciliação. */
  statement(day: string): Promise<StatementLine[]>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string, missing: string[]) {
    super(`Fornecedor de pagamentos "${provider}" sem configuração: falta ${missing.join(", ")}.`);
  }
}
