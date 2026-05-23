-- Add subscription lifecycle columns to profiles
ALTER TABLE "profiles" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "billing_interval" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "subscription_period_end" timestamp with time zone;--> statement-breakpoint

-- Add processing and idempotency columns to subscription_events
ALTER TABLE "subscription_events" ADD COLUMN "processed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD COLUMN "processing_error" text;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD COLUMN "stripe_event_created_at" integer;--> statement-breakpoint

-- Add index on stripe_subscription_id for webhook lookups
CREATE INDEX "idx_profiles_stripe_sub" ON "profiles" USING btree ("stripe_subscription_id") WHERE "profiles"."stripe_subscription_id" IS NOT NULL;
