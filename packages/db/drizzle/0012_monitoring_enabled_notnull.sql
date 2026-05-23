-- Make monitoring_schedules.enabled NOT NULL with default true (#44)
-- Backfill any existing NULL values before adding the constraint
UPDATE "monitoring_schedules" SET "enabled" = true WHERE "enabled" IS NULL;
--> statement-breakpoint
ALTER TABLE "monitoring_schedules" ALTER COLUMN "enabled" SET NOT NULL;
