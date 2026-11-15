import {
  pgTable, text, integer, boolean, timestamp, jsonb, uniqueIndex, index, bigint,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();

// ---------------------------------------------------------------- contas
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  role: text("role").notNull(), // streamer | assistant | admin
  adminRole: text("admin_role"), // super_admin | operations | finance | compliance
  displayName: text("display_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  birthDate: text("birth_date"),
  emailVerifiedAt: ts("email_verified_at"),
  phoneVerifiedAt: ts("phone_verified_at"),
  status: text("status").notNull().default("active"), // active | suspended | deleted
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: ts("locked_until"),
  twoFactorMethod: text("two_factor_method"), // totp | sms | null
  totpSecretEnc: text("totp_secret_enc"),
  totpPendingEnc: text("totp_pending_enc"),
  recoveryCodes: jsonb("recovery_codes").$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => ({
  email: uniqueIndex("users_email_uq").on(t.email),
  phone: uniqueIndex("users_phone_uq").on(t.phone),
}));

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  refreshHash: text("refresh_hash").notNull(),
  userAgent: text("user_agent"),
  ip: text("ip"),
  createdAt: createdAt(),
  lastUsedAt: ts("last_used_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  revokedAt: ts("revoked_at"),
}, (t) => ({ user: index("sessions_user_idx").on(t.userId) }));

export const otpCodes = pgTable("otp_codes", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  target: text("target").notNull(),
  purpose: text("purpose").notNull(), // verify_phone | verify_email | reset_password | login_2fa | change_contact | withdrawal
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  data: jsonb("data").$type<Record<string, unknown>>(),
  expiresAt: ts("expires_at").notNull(),
  consumedAt: ts("consumed_at"),
  createdAt: createdAt(),
}, (t) => ({ target: index("otp_target_idx").on(t.target, t.purpose) }));

// ---------------------------------------------------------------- streamers
export const streamers = pgTable("streamers", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  handle: text("handle").notNull(),
  /** RN-CON-03: o nome de utilizador só muda 1 vez a cada 30 dias. */
  handleChangedAt: ts("handle_changed_at"),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull().default(""),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  socials: jsonb("socials").$type<Record<string, string>>().notNull().default({}),
  thankYouMessage: text("thank_you_message").notNull().default("Obrigado pelo apoio!"),
  showTopDonors: boolean("show_top_donors").notNull().default(true),
  showRecentMessages: boolean("show_recent_messages").notNull().default(true),
  offlineBehavior: text("offline_behavior").notNull().default("queue"), // queue | block
  acceptingMessages: boolean("accepting_messages").notNull().default(true),
  isLive: boolean("is_live").notNull().default(false),
  platform: text("platform"), // tiktok | youtube | twitch | kick | facebook | instagram
  device: text("device"), // pc | telemovel
  outputMode: text("output_mode").notNull().default("overlay"), // overlay | audio_only
  queueOrder: text("queue_order").notNull().default("arrival"), // arrival | amount
  /** Intervalo entre mensagens, 0–5000 ms (RN-FIL-06). */
  intervalMs: integer("interval_ms").notNull().default(1500),
  volume: integer("volume").notNull().default(80),
  alertSettings: jsonb("alert_settings").$type<Record<string, unknown>>().notNull().default({}),
  feePercent: integer("fee_percent"),
  status: text("status").notNull().default("active"), // active | suspended | removed
  kycStatus: text("kyc_status").notNull().default("not_started"),
  internalNotes: text("internal_notes").notNull().default(""),
  onboardingCompletedAt: ts("onboarding_completed_at"),
  createdAt: createdAt(),
}, (t) => ({
  handle: uniqueIndex("streamers_handle_uq").on(t.handle),
  user: uniqueIndex("streamers_user_uq").on(t.userId),
}));

export const pricingRules = pgTable("pricing_rules", {
  streamerId: text("streamer_id").primaryKey(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const voices = pgTable("voices", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  premium: boolean("premium").notNull().default(false),
  provider: text("provider").notNull().default("default"),
  providerVoiceId: text("provider_voice_id").notNull().default(""),
  active: boolean("active").notNull().default(true),
});

export const soundEffects = pgTable("sound_effects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  storageKey: text("storage_key"),
  active: boolean("active").notNull().default(true),
});

export const blockedWords = pgTable("blocked_words", {
  id: text("id").primaryKey(),
  streamerId: text("streamer_id"), // null = lista base da plataforma
  word: text("word").notNull(),
  createdAt: createdAt(),
}, (t) => ({ s: index("blocked_words_streamer_idx").on(t.streamerId) }));

export const blockedDonors = pgTable("blocked_donors", {
  id: text("id").primaryKey(),
  streamerId: text("streamer_id"), // null = bloqueio global (antifraude)
  phone: text("phone"),
  deviceId: text("device_id"),
  reason: text("reason").notNull().default(""),
  createdAt: createdAt(),
}, (t) => ({ s: index("blocked_donors_streamer_idx").on(t.streamerId) }));

// ---------------------------------------------------------------- pedidos e pagamentos
export const audioUploads = pgTable("audio_uploads", {
  id: text("id").primaryKey(),
  streamerId: text("streamer_id").notNull(),
  storageKey: text("storage_key").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  durationMs: integer("duration_ms").notNull(),
  orderId: text("order_id"),
  expiresAt: ts("expires_at").notNull(),
  deletedAt: ts("deleted_at"),
  createdAt: createdAt(),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  streamerId: text("streamer_id").notNull(),
  donorName: text("donor_name").notNull(),
  anonymous: boolean("anonymous").notNull().default(false),
  donorPhone: text("donor_phone"),
  deviceId: text("device_id"),
  kind: text("kind").notNull(), // text | audio
  text: text("text"),
  voiceId: text("voice_id"),
  effectId: text("effect_id"),
  priority: boolean("priority").notNull().default(false),
  audioTierSeconds: integer("audio_tier_seconds"),
  audioUploadId: text("audio_upload_id"),
  lines: jsonb("lines").$type<{ label: string; kz: number }[]>().notNull(),
  amount: integer("amount").notNull(),
  feePercent: integer("fee_percent").notNull(),
  feeAmount: integer("fee_amount").notNull(),
  netAmount: integer("net_amount").notNull(),
  status: text("status").notNull(),
  statusReason: text("status_reason"),
  offlineAtCreation: boolean("offline_at_creation").notNull().default(false),
  audioKey: text("audio_key"),
  durationMs: integer("duration_ms"),
  playCount: integer("play_count").notNull().default(0),
  ip: text("ip"),
  createdAt: createdAt(),
  expiresAt: ts("expires_at").notNull(),
  paidAt: ts("paid_at"),
  startedAt: ts("started_at"),
  playedAt: ts("played_at"),
  failedAt: ts("failed_at"),
  refundedAt: ts("refunded_at"),
  releasedAt: ts("released_at"),
}, (t) => ({
  streamerStatus: index("orders_streamer_status_idx").on(t.streamerId, t.status),
  phone: index("orders_phone_idx").on(t.donorPhone),
}));

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  method: text("method").notNull(), // mcx | reference | unitel_money | afrimoney | card
  provider: text("provider").notNull(),
  providerRef: text("provider_ref"),
  status: text("status").notNull(), // created | pending | confirmed | declined | expired | error | refund_requested | refunded | refund_failed
  amount: integer("amount").notNull(),
  phone: text("phone"),
  referenceEntity: text("reference_entity"),
  referenceNumber: text("reference_number"),
  redirectUrl: text("redirect_url"),
  expiresAt: ts("expires_at").notNull(),
  confirmedAt: ts("confirmed_at"),
  failureReason: text("failure_reason"),
  raw: jsonb("raw").$type<unknown>(),
  disputed: boolean("disputed").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => ({
  order: index("payments_order_idx").on(t.orderId),
  providerRef: index("payments_provider_ref_idx").on(t.provider, t.providerRef),
}));

export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  payload: jsonb("payload").$type<unknown>(),
  signatureOk: boolean("signature_ok").notNull(),
  processedAt: ts("processed_at"),
  error: text("error"),
  createdAt: createdAt(),
}, (t) => ({ uq: uniqueIndex("webhook_events_uq").on(t.provider, t.eventId) }));

export const refunds = pgTable("refunds", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  paymentId: text("payment_id").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull(), // processing | refunded | failed | awaiting_claim
  destinationPhone: text("destination_phone"),
  providerRef: text("provider_ref"),
  claimDeadline: ts("claim_deadline"),
  createdAt: createdAt(),
  completedAt: ts("completed_at"),
});

// ---------------------------------------------------------------- ledger (dupla entrada, imutável)
export const ledgerEntries = pgTable("ledger_entries", {
  id: text("id").primaryKey(),
  txId: text("tx_id").notNull(),
  account: text("account").notNull(),
  // positivo = crédito, negativo = débito. Soma por tx_id = 0.
  amount: bigint("amount", { mode: "number" }).notNull(),
  kind: text("kind").notNull(), // message_credit | fee | release | refund | withdrawal | withdrawal_fee | withdrawal_reversal | adjustment | refund_payout | withdrawal_payout
  refType: text("ref_type"),
  refId: text("ref_id"),
  memo: text("memo").notNull().default(""),
  idempotencyKey: text("idempotency_key"),
  createdAt: createdAt(),
}, (t) => ({
  account: index("ledger_account_idx").on(t.account, t.createdAt),
  tx: index("ledger_tx_idx").on(t.txId),
  idem: uniqueIndex("ledger_idem_uq").on(t.idempotencyKey, t.account),
}));

// ---------------------------------------------------------------- reprodução
export const widgetTokens = pgTable("widget_tokens", {
  id: text("id").primaryKey(),
  streamerId: text("streamer_id").notNull(),
  kind: text("kind").notNull(), // overlay | goal | ranking | latest | qr | combined | player
  token: text("token").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
  revokedAt: ts("revoked_at"),
  lastSeenAt: ts("last_seen_at"),
}, (t) => ({ token: uniqueIndex("widget_tokens_token_uq").on(t.token) }));

export const goals = pgTable("goals", {
  id: text("id").primaryKey(),
  streamerId: text("streamer_id").notNull(),
  title: text("title").notNull(),
  target: integer("target").notNull(),
  startsAt: ts("starts_at").notNull().defaultNow(),
  endsAt: ts("ends_at"),
  status: text("status").notNull().default("active"), // active | closed
  closedAt: ts("closed_at"),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- assistentes
export const assistantLinks = pgTable("assistant_links", {
  id: text("id").primaryKey(),
  streamerId: text("streamer_id").notNull(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  inviteToken: text("invite_token").notNull(),
  userId: text("user_id"),
  status: text("status").notNull().default("invited"), // invited | active | removed
  createdAt: createdAt(),
  acceptedAt: ts("accepted_at"),
  removedAt: ts("removed_at"),
}, (t) => ({ token: uniqueIndex("assistant_invite_uq").on(t.inviteToken) }));

// ---------------------------------------------------------------- KYC e levantamentos
export const kycSubmissions = pgTable("kyc_submissions", {
  id: text("id").primaryKey(),
  streamerId: text("streamer_id").notNull(),
  status: text("status").notNull(), // pending | approved | rejected | correction_requested
  fullName: text("full_name").notNull(),
  birthDate: text("birth_date").notNull(),
  biNumber: text("bi_number").notNull(),
  nif: text("nif").notNull(),
  address: text("address").notNull(),
  iban: text("iban").notNull(),
  bankName: text("bank_name").notNull(),
  documents: jsonb("documents").$type<Record<string, string>>().notNull().default({}),
  decisionReason: text("decision_reason"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: ts("reviewed_at"),
  createdAt: createdAt(),
});

export const bankAccounts = pgTable("bank_accounts", {
  id: text("id").primaryKey(),
  streamerId: text("streamer_id").notNull(),
  iban: text("iban").notNull(),
  bankName: text("bank_name").notNull(),
  holderName: text("holder_name").notNull(),
  status: text("status").notNull(), // pending | verified | replaced
  verifiedAt: ts("verified_at"),
  withdrawalsLockedUntil: ts("withdrawals_locked_until"),
  createdAt: createdAt(),
});

export const withdrawals = pgTable("withdrawals", {
  id: text("id").primaryKey(),
  streamerId: text("streamer_id").notNull(),
  amount: integer("amount").notNull(),
  fee: integer("fee").notNull(),
  destinationType: text("destination_type").notNull(), // iban | mcx
  destinationLabel: text("destination_label").notNull(),
  destination: jsonb("destination").$type<Record<string, string>>().notNull(),
  status: text("status").notNull(), // requested | in_review | approved | paying | paid | rejected | failed
  manualReview: boolean("manual_review").notNull().default(false),
  riskLevel: text("risk_level").notNull().default("baixo"),
  rejectReason: text("reject_reason"),
  proofKey: text("proof_key"),
  reviewedBy: text("reviewed_by"),
  batchId: text("batch_id"),
  createdAt: createdAt(),
  approvedAt: ts("approved_at"),
  paidAt: ts("paid_at"),
});

// ---------------------------------------------------------------- notificações e suporte
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  event: text("event").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>(),
  channels: jsonb("channels").$type<string[]>().notNull().default([]),
  readAt: ts("read_at"),
  createdAt: createdAt(),
}, (t) => ({ user: index("notifications_user_idx").on(t.userId, t.createdAt) }));

export const notificationPrefs = pgTable("notification_prefs", {
  userId: text("user_id").primaryKey(),
  prefs: jsonb("prefs").$type<Record<string, string[]>>().notNull(),
});

export const supportTickets = pgTable("support_tickets", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  donorPhone: text("donor_phone"),
  orderId: text("order_id"),
  subject: text("subject").notNull(),
  category: text("category").notNull(), // refund | payment | account | report | other
  status: text("status").notNull().default("open"), // open | in_progress | waiting_user | closed
  priority: text("priority").notNull().default("normal"), // low | normal | high
  assigneeId: text("assignee_id"),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const supportMessages = pgTable("support_messages", {
  id: text("id").primaryKey(),
  ticketId: text("ticket_id").notNull(),
  authorId: text("author_id"),
  authorType: text("author_type").notNull(), // user | admin | system
  body: text("body").notNull(),
  internal: boolean("internal").notNull().default(false),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- moderação, antifraude, reconciliação
export const contentReports = pgTable("content_reports", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  streamerId: text("streamer_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"), // open | upheld | dismissed
  resolution: text("resolution"),
  reviewedBy: text("reviewed_by"),
  createdAt: createdAt(),
});

export const fraudAlerts = pgTable("fraud_alerts", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(), // many_payments_same_phone | self_donation | atypical_amount | donor_limit | withdrawal_risk
  severity: text("severity").notNull(), // low | medium | high
  streamerId: text("streamer_id"),
  donorPhone: text("donor_phone"),
  orderId: text("order_id"),
  data: jsonb("data").$type<Record<string, unknown>>(),
  status: text("status").notNull().default("open"), // open | dismissed | confirmed
  resolvedBy: text("resolved_by"),
  createdAt: createdAt(),
});

export const reconciliationRuns = pgTable("reconciliation_runs", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  day: text("day").notNull(), // AAAA-MM-DD
  status: text("status").notNull(), // done | failed
  summary: jsonb("summary").$type<Record<string, number>>().notNull().default({}),
  createdBy: text("created_by"),
  createdAt: createdAt(),
});

export const reconciliationItems = pgTable("reconciliation_items", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  kind: text("kind").notNull(), // gateway_without_order | order_without_payment | amount_mismatch
  orderId: text("order_id"),
  providerRef: text("provider_ref"),
  gatewayAmount: integer("gateway_amount"),
  ledgerAmount: integer("ledger_amount"),
  status: text("status").notNull().default("open"), // open | resolved
  resolution: text("resolution"),
  resolvedBy: text("resolved_by"),
  createdAt: createdAt(),
});

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  actorId: text("actor_id"),
  actorType: text("actor_type").notNull(), // streamer | assistant | admin | system | donor
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  streamerId: text("streamer_id"),
  data: jsonb("data").$type<Record<string, unknown>>(),
  ip: text("ip"),
  createdAt: createdAt(),
}, (t) => ({
  actor: index("audit_actor_idx").on(t.actorId, t.createdAt),
  streamer: index("audit_streamer_idx").on(t.streamerId, t.createdAt),
}));
