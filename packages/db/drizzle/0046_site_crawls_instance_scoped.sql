-- v0.2 multi-page crawler (#10): decouple site_crawls from the auth
-- layer and tie crawls to monitoring projects instead.

DROP INDEX IF EXISTS "idx_site_crawls_user";--> statement-breakpoint
ALTER TABLE "site_crawls" DROP COLUMN IF EXISTS "user_id" CASCADE;--> statement-breakpoint

ALTER TABLE "site_crawls"
	ADD COLUMN IF NOT EXISTS "monitoring_project_id" uuid;--> statement-breakpoint

ALTER TABLE "site_crawls"
	ADD CONSTRAINT "site_crawls_monitoring_project_id_fkey"
	FOREIGN KEY ("monitoring_project_id") REFERENCES "monitoring_projects"("id")
	ON DELETE SET NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_site_crawls_project"
	ON "site_crawls" ("monitoring_project_id", "started_at" DESC);
