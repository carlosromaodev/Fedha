import { z } from "zod";
import { OutputMode } from "../alert-event";
import { AoPhone, Device, IsoDate, Kz, Page, Platform, PriceLine } from "./common";
import { OrderStatus } from "./public";

// ------------------------------------------------------------- S8 perfil e página pública
export const StreamerProfile = z.object({
  id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  bio: z.string(),
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  socials: z.record(z.string()),
  thankYouMessage: z.string(),
  showTopDonors: z.boolean(),
  showRecentMessages: z.boolean(),
  offlineBehavior: z.enum(["queue", "block"]),
  acceptingMessages: z.boolean(),
  isLive: z.boolean(),
  platform: Platform.nullable(),
  device: Device.nullable(),
  outputMode: OutputMode,
  queueOrder: z.enum(["arrival", "amount"]),
  intervalMs: z.number().int(),
  volume: z.number().int(),
  kycStatus: z.enum(["not_started", "pending", "approved", "rejected", "correction_requested"]),
  publicUrl: z.string(),
  onboardingCompleted: z.boolean(),
});
export type StreamerProfile = z.infer<typeof StreamerProfile>;

export const UpdateProfileBody = z.object({
  displayName: z.string().trim().min(2).max(40),
  bio: z.string().max(300),
  socials: z.record(z.string().url().or(z.string().max(60))),
  thankYouMessage: z.string().max(200),
  showTopDonors: z.boolean(),
  showRecentMessages: z.boolean(),
  offlineBehavior: z.enum(["queue", "block"]),
  acceptingMessages: z.boolean(),
}).partial();

export const OnboardingBody = z.object({ platform: Platform, device: Device });
export const OnboardingResponse = z.object({
  scenario: z.enum(["C1", "C2", "C3", "C4", "C5"]),
  guide: z.enum(["G1", "G2", "G3", "G4", "G5", "G6", "G7"]),
  outputMode: OutputMode,
  title: z.string(),
  steps: z.array(z.string()),
  qrAllowed: z.boolean(),
  experimental: z.boolean(),
});
export const SetLiveBody = z.object({ isLive: z.boolean() });
export const PlaybackSettingsBody = z.object({
  volume: z.number().int().min(0).max(100),
  /** RN-FIL-06: 0 a 5 s, predefinição 1,5 s. */
  intervalMs: z.number().int().min(0).max(5000),
  queueOrder: z.enum(["arrival", "amount"]),
  outputMode: OutputMode,
}).partial();

// ------------------------------------------------------------- S9 filtros
export const FiltersView = z.object({
  /** Sempre ligados, sem opção de desligar. */
  alwaysOn: z.object({ links: z.literal(true), emails: z.literal(true), phones: z.literal(true), qr: z.literal(true) }),
  blockedWords: z.array(z.string()),
  baseWordsCount: z.number().int(),
  audioEnabled: z.boolean(),
  audioMaxSeconds: z.number().int(),
});
export const UpdateFiltersBody = z.object({ blockedWords: z.array(z.string().trim().min(2).max(40)).max(500) });
export const BlockedDonorView = z.object({ id: z.string(), phone: z.string().nullable(), deviceId: z.string().nullable(), reason: z.string(), createdAt: IsoDate });
export const BlockDonorBody = z.object({ phone: AoPhone.optional(), deviceId: z.string().optional(), reason: z.string().max(200).default("") })
  .refine((b) => b.phone || b.deviceId, "Indica o telemóvel ou o dispositivo.");

// ------------------------------------------------------------- S2 ações sobre a fila
export const ReportBody = z.object({ reason: z.string().trim().min(3).max(500) });

// ------------------------------------------------------------- S4 histórico
export const HistoryQuery = Page.extend({
  from: z.string().optional(),
  to: z.string().optional(),
  kind: z.enum(["text", "audio"]).optional(),
  status: OrderStatus.optional(),
  minAmount: z.coerce.number().int().optional(),
  maxAmount: z.coerce.number().int().optional(),
  q: z.string().optional(),
});
export const HistoryItem = z.object({
  id: z.string(),
  createdAt: IsoDate,
  paidAt: IsoDate.nullable(),
  playedAt: IsoDate.nullable(),
  donorName: z.string(),
  donorPhoneMasked: z.string().nullable(),
  kind: z.enum(["text", "audio"]),
  text: z.string().nullable(),
  lines: z.array(PriceLine),
  amount: Kz,
  fee: Kz,
  net: Kz,
  status: OrderStatus,
  method: z.string().nullable(),
  audioUrl: z.string().nullable(),
  tags: z.array(z.string()),
});
export const RefundRequestBody = z.object({ reason: z.string().trim().min(5).max(500) });

// ------------------------------------------------------------- S7 metas
export const GoalView = z.object({ id: z.string(), title: z.string(), target: Kz, current: Kz, startsAt: IsoDate, endsAt: IsoDate.nullable(), status: z.enum(["active", "closed"]), closedAt: IsoDate.nullable(), reached: z.boolean() });
export const CreateGoalBody = z.object({ title: z.string().trim().min(2).max(60), target: z.number().int().min(1000), endsAt: IsoDate.nullable().optional() });

// ------------------------------------------------------------- S1 dashboard
export const DashboardQuery = z.object({ range: z.enum(["7d", "14d", "30d", "90d"]).default("14d") });
export const DashboardView = z.object({
  balances: z.object({ available: Kz, pending: Kz, nextReleaseAt: IsoDate.nullable() }),
  revenue: z.object({ today: Kz, week: Kz, month: Kz, monthGross: Kz, monthFee: Kz }),
  messages: z.object({ today: z.number().int(), month: z.number().int(), avgTicket: Kz }),
  chart: z.array(z.object({ day: z.string(), gross: Kz, net: Kz, count: z.number().int() })),
  topDonors: z.array(z.object({ donorName: z.string(), total: Kz, count: z.number().int() })),
  latest: z.array(z.object({ id: z.string(), donorName: z.string(), text: z.string().nullable(), amount: Kz, status: OrderStatus, at: IsoDate })),
  outputs: z.object({ overlay: z.boolean(), player: z.boolean() }),
  alerts: z.array(z.object({ kind: z.string(), message: z.string() })),
});

// ------------------------------------------------------------- S11/S12 carteira
export const WalletView = z.object({
  available: Kz,
  pending: Kz,
  nextReleaseAt: IsoDate.nullable(),
  month: z.object({ gross: Kz, fee: Kz, net: Kz }),
  withdrawal: z.object({ fee: Kz, min: Kz, canWithdraw: z.boolean(), blockers: z.array(z.string()) }),
});
export const LedgerQuery = Page.extend({ from: z.string().optional(), to: z.string().optional() });
export const LedgerRow = z.object({
  id: z.string(),
  at: IsoDate,
  kind: z.string(),
  label: z.string(),
  account: z.enum(["pending", "available"]),
  amount: z.number().int(),
  balanceAfter: z.number().int(),
  refId: z.string().nullable(),
});

export const WithdrawalStatus = z.enum(["requested", "in_review", "approved", "paying", "paid", "rejected", "failed"]);
export const WithdrawalView = z.object({
  id: z.string(), amount: Kz, fee: Kz, total: Kz, destinationType: z.enum(["iban", "mcx"]), destinationLabel: z.string(),
  status: WithdrawalStatus, rejectReason: z.string().nullable(), createdAt: IsoDate, paidAt: IsoDate.nullable(), proofUrl: z.string().nullable(),
});
export const WithdrawalQuoteQuery = z.object({ amount: z.coerce.number().int().min(1) });
export const WithdrawalQuote = z.object({ amount: Kz, fee: Kz, totalDebited: Kz, available: Kz, ok: z.boolean(), problems: z.array(z.string()), manualReview: z.boolean() });
export const CreateWithdrawalBody = z.object({ amount: z.number().int().min(1), destinationType: z.enum(["iban", "mcx"]), twoFactorCode: z.string().trim().min(6) });

// ------------------------------------------------------------- A7 KYC
export const KycStatus = z.enum(["not_started", "pending", "approved", "rejected", "correction_requested"]);
export const KycView = z.object({
  status: KycStatus,
  reason: z.string().nullable(),
  submittedAt: IsoDate.nullable(),
  data: z.object({ fullName: z.string(), birthDate: z.string(), biNumber: z.string(), nif: z.string(), address: z.string(), iban: z.string(), bankName: z.string() }).nullable(),
  documents: z.array(z.string()),
  limits: z.object({ unverifiedLimit: Kz, receivedSoFar: Kz }),
  bankAccount: z.object({ ibanMasked: z.string(), bankName: z.string(), verified: z.boolean(), withdrawalsLockedUntil: IsoDate.nullable() }).nullable(),
});
/** Campos de texto do multipart POST /v1/streamer/kyc. Ficheiros: bi_front, bi_back, selfie, bank_proof, nif_doc (opcional). */
export const KycFields = z.object({
  fullName: z.string().trim().min(5).max(100),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  biNumber: z.string().trim().regex(/^\d{9}[A-Z]{2}\d{3}$/i, "Número do BI inválido (ex.: 000000000LA000)."),
  nif: z.string().trim().min(9).max(14),
  address: z.string().trim().min(5).max(200),
  iban: z.string().transform((v) => v.replace(/\s/g, "").toUpperCase()).pipe(z.string().regex(/^AO06\d{21}$/, "IBAN angolano inválido (AO06 + 21 dígitos).")),
  bankName: z.string().trim().min(2).max(60),
});

// ------------------------------------------------------------- S10 assistentes
export const AssistantView = z.object({ id: z.string(), name: z.string(), contact: z.string(), status: z.enum(["invited", "active", "removed"]), inviteUrl: z.string().nullable(), createdAt: IsoDate, acceptedAt: IsoDate.nullable() });
export const InviteAssistantBody = z.object({ name: z.string().trim().min(2).max(60), contact: z.string().trim().min(5).max(100) });
export const AssistantActionView = z.object({ id: z.string(), action: z.string(), data: z.record(z.unknown()).nullable(), at: IsoDate });

// ------------------------------------------------------------- S13 notificações
export const NotificationEvent = z.enum(["new_message", "report_reviewed", "withdrawal_paid", "withdrawal_rejected", "kyc_decided", "refund", "security"]);
export const NotificationChannel = z.enum(["email", "sms", "whatsapp", "push"]);
export const NotificationPrefs = z.record(NotificationEvent, z.array(NotificationChannel));
export const NotificationView = z.object({ id: z.string(), event: z.string(), title: z.string(), body: z.string(), readAt: IsoDate.nullable(), createdAt: IsoDate });
export const MarkReadBody = z.object({ ids: z.array(z.string()).optional() });

// ------------------------------------------------------------- S15 / B10 suporte
export const TicketView = z.object({
  id: z.string(), subject: z.string(), category: z.string(), status: z.enum(["open", "in_progress", "waiting_user", "closed"]), priority: z.enum(["low", "normal", "high"]),
  orderId: z.string().nullable(), assigneeId: z.string().nullable(), createdAt: IsoDate, updatedAt: IsoDate,
  messages: z.array(z.object({ id: z.string(), authorType: z.string(), body: z.string(), createdAt: IsoDate })).optional(),
});
export const CreateTicketBody = z.object({ subject: z.string().trim().min(3).max(120), category: z.enum(["refund", "payment", "account", "report", "other"]), body: z.string().trim().min(5).max(4000), orderId: z.string().optional() });
export const TicketMessageBody = z.object({ body: z.string().trim().min(1).max(4000) });
