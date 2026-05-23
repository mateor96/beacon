-- Instance-scoped feature reactivation (v0.2 phase 1).
--
-- Beacon's monitoring / fix-generation / deploy / webhook / csv-export
-- features were originally per-user. The OSS build runs single-tenant:
-- the operator IS the only user, so user_id is dead state. This migration
-- drops the column from feature tables and removes the api_keys table
-- entirely (replaced by a single BEACON_API_TOKEN env var, see #7).
--
-- The `profiles` table itself is retained for future operator-login work
-- but is unused in OSS mode. The `scans.user_id` column is already
-- nullable and stays — anonymous scans pass NULL, archived auth can
-- repopulate it.

-- ── Drop indexes that reference user_id ────────────────────────────────
DROP INDEX IF EXISTS "idx_generated_fixes_user";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_generated_fixes_user_type_created";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_cms_connections_user";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_cms_connections_user_active";--> statement-breakpoint
DROP INDEX IF EXISTS "uq_cms_connections_active_per_site";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_webhook_endpoints_user";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_webhook_endpoints_user_active";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_csv_exports_user_created";--> statement-breakpoint

-- ── Drop user_id columns (CASCADE drops the auto-generated FK constraints) ──
ALTER TABLE "monitoring_projects" DROP COLUMN IF EXISTS "user_id" CASCADE;--> statement-breakpoint
ALTER TABLE "generated_fixes" DROP COLUMN IF EXISTS "user_id" CASCADE;--> statement-breakpoint
ALTER TABLE "cms_connections" DROP COLUMN IF EXISTS "user_id" CASCADE;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" DROP COLUMN IF EXISTS "user_id" CASCADE;--> statement-breakpoint
ALTER TABLE "csv_exports" DROP COLUMN IF EXISTS "user_id" CASCADE;--> statement-breakpoint

-- ── Recreate instance-scoped indexes ───────────────────────────────────
CREATE INDEX IF NOT EXISTS "idx_generated_fixes_type_created"
	ON "generated_fixes" ("fix_type", "created_at" DESC)
	WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cms_connections_active"
	ON "cms_connections" ("cms_type")
	WHERE "is_active" = true AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_cms_connections_active_per_site"
	ON "cms_connections" ("cms_type", "site_url")
	WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_endpoints_active"
	ON "webhook_endpoints" ("active")
	WHERE "active" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_csv_exports_created"
	ON "csv_exports" ("created_at" DESC);--> statement-breakpoint

-- ── Drop api_keys entirely ─────────────────────────────────────────────
DROP TABLE IF EXISTS "api_keys" CASCADE;
