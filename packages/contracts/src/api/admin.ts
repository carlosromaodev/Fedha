import { z } from "zod";
import { AoPhone, IsoDate, Kz, Page, PaymentMethod } from "./common";
import { AdminRole, Password } from "./auth";
import { PricingConfig } from "./pricing";

// B9 — configurações da plataforma
export const PlatformSettings = z.object({
  platformFeePercent: z.number().min(0).max(50),
  withdrawalFee: Kz,
  withdrawalMin: Kz,
  retentionHours: z.number().int().min(0).max(24 * 30),
  cardRetentionHours: z.number().int().min(0).max(24 * 60),
  manualReviewAbove: Kz,
  newAccountDays: z.number().int().min(0),
  kycUnverifiedLimit: Kz,
  donorDailyMaxMessages: z.number().int().min(1),
  donorDailyMaxAmount: Kz,
  mcxTtlMinutes: z.number().int().min(1).max(30),
  referenceTtlMinutes: z.number().int().min(5).max(60 * 72),
  activeMethods: z.array(PaymentMethod),
  maxCharsCeiling: z.number().int().min(50).max(300),
  atypicalAmount: Kz,
  samePhoneHourlyAlert: z.number().int().min(1),
  unplayedRefundDays: z.number().int().min(1),
  unclaimedRefundDays: z.number().int().min(1),
  audioRetentionDays: z.number().int().min(1),
  defaultPricing: PricingConfig,
});
export type PlatformSettings = z.infer<typeof PlatformSettings>;

export const AdminListQuery = Page.extend({ q: z.string().optional(), status: z.string().optional(), from: z.string().optional(), to: z.string().optional(), method: PaymentMethod.optional(), streamerId: z.string().optional() });

export const AdminStreamerRow = z.object({ id: z.string(), handle: z.string(), displayName: z.string(), email: z.string(), platform: z.string().nullable(), kycStatus: z.string(), status: z.string(), monthGross: Kz, available: Kz, pending: Kz, feePercent: z.number().nullable(), createdAt: IsoDate });
export const SetFeeBody = z.object({ feePercent: z.number().min(0).max(50).nullable() });
export const NotesBody = z.object({ notes: z.string().max(5000) });
export const ReasonBody = z.object({ reason: z.string().trim().min(3).max(500) });

export const TransactionRow = z.object({ id: z.string(), createdAt: IsoDate, donorName: z.string(), donorPhone: z.string().nullable(), streamer: z.string(), method: PaymentMethod.nullable(), amount: Kz, orderStatus: z.string(), paymentStatus: z.string().nullable(), disputed: z.boolean() });

export const MarkPaidBody = z.object({ note: z.string().max(500).optional() });
export const ResolveBody = z.object({ resolution: z.string().trim().min(3).max(500) });
export const RunReconciliationBody = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), provider: z.string().optional() });

export const FraudAlertView = z.object({ id: z.string(), kind: z.string(), severity: z.string(), streamerId: z.string().nullable(), donorPhone: z.string().nullable(), orderId: z.string().nullable(), data: z.record(z.unknown()).nullable(), status: z.string(), createdAt: IsoDate });
export const GlobalBlockBody = z.object({ phone: AoPhone.optional(), deviceId: z.string().optional(), reason: z.string().trim().min(3) });

export const BaseWordsBody = z.object({ words: z.array(z.string().trim().min(2).max(40)).max(5000) });
export const ReportDecisionBody = z.object({ decision: z.enum(["upheld", "dismissed"]), resolution: z.string().trim().min(3).max(500), suspendDonor: z.boolean().default(false) });

export const TicketUpdateBody = z.object({ status: z.enum(["open", "in_progress", "waiting_user", "closed"]).optional(), priority: z.enum(["low", "normal", "high"]).optional(), assigneeId: z.string().nullable().optional() });
export const AdminReplyBody = z.object({ body: z.string().trim().min(1).max(4000), internal: z.boolean().default(false) });

export const CreateAdminBody = z.object({ displayName: z.string().trim().min(2), email: z.string().trim().toLowerCase().email(), password: Password, adminRole: AdminRole });
export const SetAdminRoleBody = z.object({ adminRole: AdminRole });

export const AuditRow = z.object({ id: z.string(), actorId: z.string().nullable(), actorType: z.string(), action: z.string(), targetType: z.string().nullable(), targetId: z.string().nullable(), data: z.record(z.unknown()).nullable(), ip: z.string().nullable(), createdAt: IsoDate });

/** Permissões por papel (B11). */
export const ADMIN_PERMISSIONS: Record<z.infer<typeof AdminRole>, string[]> = {
  super_admin: ["*"],
  operations: ["streamers", "kyc", "support", "moderation", "overview"],
  finance: ["transactions", "reconciliation", "withdrawals", "overview", "streamers.read"],
  compliance: ["fraud", "moderation", "transactions.read", "overview", "streamers.read", "kyc.read", "audit"],
};
