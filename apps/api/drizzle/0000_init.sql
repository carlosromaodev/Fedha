CREATE TABLE IF NOT EXISTS "assistant_links" (
	"id" text PRIMARY KEY NOT NULL,
	"streamer_id" text NOT NULL,
	"name" text NOT NULL,
	"contact" text NOT NULL,
	"invite_token" text NOT NULL,
	"user_id" text,
	"status" text DEFAULT 'invited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audio_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"streamer_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"order_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_type" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"streamer_id" text,
	"data" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bank_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"streamer_id" text NOT NULL,
	"iban" text NOT NULL,
	"bank_name" text NOT NULL,
	"holder_name" text NOT NULL,
	"status" text NOT NULL,
	"verified_at" timestamp with time zone,
	"withdrawals_locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blocked_donors" (
	"id" text PRIMARY KEY NOT NULL,
	"streamer_id" text,
	"phone" text,
	"device_id" text,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blocked_words" (
	"id" text PRIMARY KEY NOT NULL,
	"streamer_id" text,
	"word" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"streamer_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"reviewed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fraud_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"severity" text NOT NULL,
	"streamer_id" text,
	"donor_phone" text,
	"order_id" text,
	"data" jsonb,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"streamer_id" text NOT NULL,
	"title" text NOT NULL,
	"target" integer NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"streamer_id" text NOT NULL,
	"status" text NOT NULL,
	"full_name" text NOT NULL,
	"birth_date" text NOT NULL,
	"bi_number" text NOT NULL,
	"nif" text NOT NULL,
	"address" text NOT NULL,
	"iban" text NOT NULL,
	"bank_name" text NOT NULL,
	"documents" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"decision_reason" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"tx_id" text NOT NULL,
	"account" text NOT NULL,
	"amount" bigint NOT NULL,
	"kind" text NOT NULL,
	"ref_type" text,
	"ref_id" text,
	"memo" text DEFAULT '' NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_prefs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"prefs" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"streamer_id" text NOT NULL,
	"donor_name" text NOT NULL,
	"anonymous" boolean DEFAULT false NOT NULL,
	"donor_phone" text,
	"device_id" text,
	"kind" text NOT NULL,
	"text" text,
	"voice_id" text,
	"effect_id" text,
	"priority" boolean DEFAULT false NOT NULL,
	"audio_tier_seconds" integer,
	"audio_upload_id" text,
	"lines" jsonb NOT NULL,
	"amount" integer NOT NULL,
	"fee_percent" integer NOT NULL,
	"fee_amount" integer NOT NULL,
	"net_amount" integer NOT NULL,
	"status" text NOT NULL,
	"status_reason" text,
	"offline_at_creation" boolean DEFAULT false NOT NULL,
	"audio_key" text,
	"duration_ms" integer,
	"play_count" integer DEFAULT 0 NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"played_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "otp_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"target" text NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"data" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"method" text NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"status" text NOT NULL,
	"amount" integer NOT NULL,
	"phone" text,
	"reference_entity" text,
	"reference_number" text,
	"redirect_url" text,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"failure_reason" text,
	"raw" jsonb,
	"disputed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pricing_rules" (
	"streamer_id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reconciliation_items" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"kind" text NOT NULL,
	"order_id" text,
	"provider_ref" text,
	"gateway_amount" integer,
	"ledger_amount" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reconciliation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"day" text NOT NULL,
	"status" text NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"status" text NOT NULL,
	"destination_phone" text,
	"provider_ref" text,
	"claim_deadline" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"refresh_hash" text NOT NULL,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sound_effects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"storage_key" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "streamers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"banner_url" text,
	"socials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"thank_you_message" text DEFAULT 'Obrigado pelo apoio!' NOT NULL,
	"show_top_donors" boolean DEFAULT true NOT NULL,
	"show_recent_messages" boolean DEFAULT true NOT NULL,
	"offline_behavior" text DEFAULT 'queue' NOT NULL,
	"accepting_messages" boolean DEFAULT true NOT NULL,
	"is_live" boolean DEFAULT false NOT NULL,
	"platform" text,
	"device" text,
	"output_mode" text DEFAULT 'overlay' NOT NULL,
	"queue_order" text DEFAULT 'arrival' NOT NULL,
	"interval_seconds" integer DEFAULT 3 NOT NULL,
	"volume" integer DEFAULT 80 NOT NULL,
	"alert_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fee_percent" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"kyc_status" text DEFAULT 'not_started' NOT NULL,
	"internal_notes" text DEFAULT '' NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"author_id" text,
	"author_type" text NOT NULL,
	"body" text NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"donor_phone" text,
	"order_id" text,
	"subject" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"assignee_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"admin_role" text,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"birth_date" text,
	"email_verified_at" timestamp with time zone,
	"phone_verified_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"two_factor_method" text,
	"totp_secret_enc" text,
	"totp_pending_enc" text,
	"recovery_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voices" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"premium" boolean DEFAULT false NOT NULL,
	"provider" text DEFAULT 'default' NOT NULL,
	"provider_voice_id" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb,
	"signature_ok" boolean NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "widget_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"streamer_id" text NOT NULL,
	"kind" text NOT NULL,
	"token" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "withdrawals" (
	"id" text PRIMARY KEY NOT NULL,
	"streamer_id" text NOT NULL,
	"amount" integer NOT NULL,
	"fee" integer NOT NULL,
	"destination_type" text NOT NULL,
	"destination_label" text NOT NULL,
	"destination" jsonb NOT NULL,
	"status" text NOT NULL,
	"manual_review" boolean DEFAULT false NOT NULL,
	"risk_level" text DEFAULT 'baixo' NOT NULL,
	"reject_reason" text,
	"proof_key" text,
	"reviewed_by" text,
	"batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_invite_uq" ON "assistant_links" USING btree ("invite_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_actor_idx" ON "audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_streamer_idx" ON "audit_log" USING btree ("streamer_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blocked_donors_streamer_idx" ON "blocked_donors" USING btree ("streamer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blocked_words_streamer_idx" ON "blocked_words" USING btree ("streamer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_account_idx" ON "ledger_entries" USING btree ("account","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_tx_idx" ON "ledger_entries" USING btree ("tx_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_idem_uq" ON "ledger_entries" USING btree ("idempotency_key","account");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_streamer_status_idx" ON "orders" USING btree ("streamer_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_phone_idx" ON "orders" USING btree ("donor_phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "otp_target_idx" ON "otp_codes" USING btree ("target","purpose");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_provider_ref_idx" ON "payments" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "streamers_handle_uq" ON "streamers" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "streamers_user_uq" ON "streamers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_uq" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_uq" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "widget_tokens_token_uq" ON "widget_tokens" USING btree ("token");