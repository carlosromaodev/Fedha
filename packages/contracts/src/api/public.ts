import { z } from "zod";
import { AoPhone, IsoDate, Kz, PaymentMethod, Platform, PriceLine } from "./common";
import { PricingConfig, SoundEffect, Voice } from "./pricing";

// ------------------------------------------------------------- P1 / P2
export const PlatformInfo = z.object({
  platformFeePercent: z.number(),
  withdrawalFee: Kz,
  withdrawalMin: Kz,
  retentionHours: z.number(),
  methods: z.array(z.object({ id: PaymentMethod, label: z.string(), active: z.boolean() })),
  voices: z.array(Voice),
  effects: z.array(SoundEffect),
});
export type PlatformInfo = z.infer<typeof PlatformInfo>;

/** Porque é que a página não aceita mensagens agora. */
export const AcceptState = z.enum(["open", "offline_queue", "offline_blocked", "paused", "kyc_limit", "suspended"]);
export type AcceptState = z.infer<typeof AcceptState>;

export const PublicMessage = z.object({ id: z.string(), donorName: z.string(), text: z.string().nullable(), kind: z.enum(["text", "audio"]), amount: Kz, at: IsoDate });
export const TopDonor = z.object({ donorName: z.string(), total: Kz, count: z.number().int() });
export const PublicGoal = z.object({ id: z.string(), title: z.string(), current: Kz, target: Kz, endsAt: IsoDate.nullable() });
export type PublicGoal = z.infer<typeof PublicGoal>;

export const PublicStreamer = z.object({
  id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  bio: z.string(),
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  socials: z.record(z.string()),
  verified: z.boolean(),
  isLive: z.boolean(),
  platform: Platform.nullable(),
  acceptState: AcceptState,
  /** Texto a mostrar quando acceptState não é "open". */
  acceptMessage: z.string().nullable(),
  thankYouMessage: z.string(),
  pricing: PricingConfig,
  voices: z.array(Voice),
  effects: z.array(SoundEffect),
  methods: z.array(PaymentMethod),
  goal: PublicGoal.nullable(),
  recentMessages: z.array(PublicMessage).nullable(),
  topDonors: z.array(TopDonor).nullable(),
});
export type PublicStreamer = z.infer<typeof PublicStreamer>;

export const StreamerSearchItem = z.object({ handle: z.string(), displayName: z.string(), avatarUrl: z.string().nullable(), isLive: z.boolean(), verified: z.boolean() });

// ------------------------------------------------------------- compositor
export const FilterHit = z.object({ kind: z.enum(["link", "email", "telefone", "qr", "palavra"]), match: z.string(), message: z.string() });
export type FilterHit = z.infer<typeof FilterHit>;

export const CheckTextBody = z.object({ text: z.string().max(1000) });
export const CheckTextResponse = z.object({ ok: z.boolean(), chars: z.number().int(), hit: FilterHit.nullable() });

export const ComposeBase = z.object({
  kind: z.enum(["text", "audio"]),
  text: z.string().max(1000).optional(),
  voiceId: z.string().optional(),
  effectId: z.string().nullable().optional(),
  priority: z.boolean().default(false),
  audioTierSeconds: z.number().int().optional(),
});
export const QuoteBody = ComposeBase;
export type QuoteBody = z.infer<typeof QuoteBody>;

export const Quote = z.object({
  lines: z.array(PriceLine),
  total: Kz,
  chars: z.number().int(),
  /** Aviso "faltam N caracteres para a próxima faixa". */
  nextTier: z.object({ atChars: z.number().int(), price: Kz }).nullable(),
  hit: FilterHit.nullable(),
});
export type Quote = z.infer<typeof Quote>;

export const AudioUploadResponse = z.object({ uploadId: z.string(), durationMs: z.number().int(), expiresAt: IsoDate });

export const CreateOrderBody = ComposeBase.extend({
  donorName: z.string().trim().max(40).default(""),
  anonymous: z.boolean().default(false),
  phone: AoPhone.optional(),
  audioUploadId: z.string().optional(),
  deviceId: z.string().max(100).optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Tens de aceitar os termos." }) }),
});
export type CreateOrderBody = z.infer<typeof CreateOrderBody>;

// ------------------------------------------------------------- pedidos e pagamentos
export const OrderStatus = z.enum([
  "awaiting_payment", "queued", "playing", "played", "expired", "payment_failed", "failed", "refund_pending", "refunded",
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const PaymentStatus = z.enum(["created", "pending", "confirmed", "declined", "expired", "error", "refund_requested", "refunded", "refund_failed"]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const PaymentView = z.object({
  id: z.string(),
  method: PaymentMethod,
  status: PaymentStatus,
  amount: Kz,
  expiresAt: IsoDate,
  phone: z.string().nullable(),
  reference: z.object({ entity: z.string(), reference: z.string(), amount: Kz }).nullable(),
  redirectUrl: z.string().nullable(),
  failureReason: z.string().nullable(),
});
export type PaymentView = z.infer<typeof PaymentView>;

export const RefundView = z.object({
  status: z.enum(["processing", "refunded", "failed", "awaiting_claim"]),
  amount: Kz,
  reason: z.string(),
  claimDeadline: IsoDate.nullable(),
});

export const OrderView = z.object({
  id: z.string(),
  streamer: z.object({ handle: z.string(), displayName: z.string() }),
  donorName: z.string(),
  kind: z.enum(["text", "audio"]),
  text: z.string().nullable(),
  lines: z.array(PriceLine),
  amount: Kz,
  status: OrderStatus,
  statusReason: z.string().nullable(),
  /** Posição na fila (1 = a seguir) quando status = queued. */
  queuePosition: z.number().int().nullable(),
  estimatedWaitSeconds: z.number().int().nullable(),
  createdAt: IsoDate,
  expiresAt: IsoDate,
  paidAt: IsoDate.nullable(),
  playedAt: IsoDate.nullable(),
  payment: PaymentView.nullable(),
  refund: RefundView.nullable(),
});
export type OrderView = z.infer<typeof OrderView>;

export const CreatePaymentBody = z.object({ method: PaymentMethod, phone: AoPhone.optional() });
export type CreatePaymentBody = z.infer<typeof CreatePaymentBody>;

export const OrderLookupBody = z.object({ orderId: z.string().trim().toUpperCase(), phone: AoPhone });
export const RefundClaimBody = z.object({ phone: AoPhone, mcxPhone: AoPhone });

/** Eventos SSE em /v1/public/orders/:id/events: "order" com OrderView. */
export const OrderEvent = z.object({ type: z.literal("order"), data: OrderView });
