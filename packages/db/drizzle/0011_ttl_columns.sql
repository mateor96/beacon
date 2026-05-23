-- TTL columns for DSGVO data minimization (#64)

-- scans: html_content_expires_at (72h default for raw HTML retention)
-- Guard: column may already exist from migration 0002
ALTER TABLE "scans" ADD COLUMN IF NOT EXISTS "html_content_expires_at" timestamp with time zone DEFAULT NOW() + INTERVAL '72 hours';
--> statement-breakpoint

-- scans: set DB default on existing expires_at column (30 days)
ALTER TABLE "scans" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '30 days';
--> statement-breakpoint

-- anonymous_scans: expires_at (30 days from scan date)
-- Guard: column may already exist from migration 0002
ALTER TABLE "anonymous_scans" ADD COLUMN IF NOT EXISTS "expires_at" date DEFAULT (CURRENT_DATE + 30) NOT NULL;
--> statement-breakpoint

-- monitoring_results: expires_at (90 days default)
-- Guard: column may already exist from migration 0002
ALTER TABLE "monitoring_results" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone DEFAULT NOW() + INTERVAL '90 days';
--> statement-breakpoint

-- Partial index for monitoring_results TTL cleanup
CREATE INDEX "idx_monitoring_results_expires_at" ON "monitoring_results" USING btree ("expires_at") WHERE "monitoring_results"."expires_at" IS NOT NULL;
