-- Open-source conversion: drop everything tied to plans, subscriptions,
-- referral commissions and guarantee claims. The archived modules under
-- archive/billing/ + archive/auth/ document how to put it back.

-- ── Tables ──────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS "referral_commissions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "referral_payouts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "referral_conversions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "referral_links" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "referral_fraud_flags" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "affiliates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "guarantee_milestones" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "guarantee_claims" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "subscription_events" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "audit_logs" CASCADE;--> statement-breakpoint

-- ── profiles columns ────────────────────────────────────────────────────
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "plan";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "stripe_customer_id";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "stripe_subscription_id";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "subscription_status";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "billing_interval";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "subscription_period_end";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "cancel_at_period_end";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "last_billing_event_at";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "quota_period_start";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "daily_scans_used";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "monthly_scans_used";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "feature_overrides";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "scan_reset_date";--> statement-breakpoint

-- ── RPC functions for quota gating ──────────────────────────────────────
-- (merge_scan_fixes stays — fix.processor still uses it to merge JSONB.)
DROP FUNCTION IF EXISTS check_scan_limit(uuid, integer);--> statement-breakpoint
DROP FUNCTION IF EXISTS check_daily_scan_limit(uuid, integer);--> statement-breakpoint
DROP FUNCTION IF EXISTS check_anonymous_scan_limit(text, integer);--> statement-breakpoint
DROP FUNCTION IF EXISTS rollback_scan_usage(uuid, uuid);--> statement-breakpoint
DROP FUNCTION IF EXISTS rollback_anonymous_scan_usage(text);
