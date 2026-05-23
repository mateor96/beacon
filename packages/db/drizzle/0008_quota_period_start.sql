-- Add quota_period_start column for monthly quota reset semantics
ALTER TABLE "profiles" ADD COLUMN "quota_period_start" timestamptz;

-- Backfill paid users: period_end minus 1 month (approximates current billing period start)
UPDATE "profiles"
SET "quota_period_start" = "subscription_period_end" - interval '1 month'
WHERE "subscription_period_end" IS NOT NULL;

-- Backfill free users: start of current calendar month
UPDATE "profiles"
SET "quota_period_start" = date_trunc('month', now())
WHERE "subscription_period_end" IS NULL;
