-- Step 1: Drop old non-unique indexes
DROP INDEX IF EXISTS "idx_profiles_stripe";
DROP INDEX IF EXISTS "idx_profiles_stripe_sub";

-- Step 2: Create partial unique indexes (NULLs excluded)
CREATE UNIQUE INDEX "idx_profiles_stripe_cust_uniq"
  ON "profiles" ("stripe_customer_id")
  WHERE "stripe_customer_id" IS NOT NULL;

CREATE UNIQUE INDEX "idx_profiles_stripe_sub_uniq"
  ON "profiles" ("stripe_subscription_id")
  WHERE "stripe_subscription_id" IS NOT NULL;

-- Step 3: Add cancel_at_period_end column (nullable)
ALTER TABLE "profiles" ADD COLUMN "cancel_at_period_end" boolean;
