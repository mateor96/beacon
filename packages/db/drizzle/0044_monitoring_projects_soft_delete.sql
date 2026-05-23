-- v0.2 monitoring UI (#4): add soft-delete column so the operator can
-- archive monitoring projects without losing historical snapshots and
-- mention data.

ALTER TABLE "monitoring_projects"
	ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_monitoring_projects_active"
	ON "monitoring_projects" ("created_at" DESC)
	WHERE "deleted_at" IS NULL;
