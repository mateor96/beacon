-- Schema/migration drift: packages/db/src/schema/profiles.ts declares
-- columns `role`, `permissions`, `report_branding` that were never added
-- by any earlier migration. The OSS build does not actively populate
-- these (no auth layer), but Drizzle's INSERT path includes them when
-- callers omit them (default values), which causes integration tests
-- to fail with "column does not exist".
--
-- Add the columns idempotently so schema and DB stay in lockstep. The
-- columns are unused by ship code; archived auth/billing under
-- `archive/` references them when re-enabled.

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "permissions" jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "report_branding" jsonb;
