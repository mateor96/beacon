-- Add stale/out-of-order protection for Stripe webhook events.
-- Stores the Stripe event.created timestamp (Unix epoch seconds) of the
-- most recently applied billing event on each profile.
ALTER TABLE "profiles" ADD COLUMN "last_billing_event_at" integer;

-- Backfill from subscription_events: set to max stripe_event_created_at
-- for each user that has successfully processed billing events.
UPDATE "profiles" p
SET "last_billing_event_at" = sub.max_ts
FROM (
  SELECT "user_id", MAX("stripe_event_created_at") AS max_ts
  FROM "subscription_events"
  WHERE "user_id" IS NOT NULL
    AND "processed_at" IS NOT NULL
    AND "stripe_event_created_at" IS NOT NULL
  GROUP BY "user_id"
) sub
WHERE p."id" = sub."user_id";
