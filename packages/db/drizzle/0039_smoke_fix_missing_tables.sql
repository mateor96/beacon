-- Reconciles schema.ts with migrations after the botched 0020 re-baseline
-- was reduced to a stub. Creates the 6 tables defined in schema.ts that
-- otherwise have no CREATE TABLE in any migration: score_snapshots,
-- roi_reports, roi_milestones, ai_citation_tracking, webhook_endpoints,
-- webhook_deliveries.
CREATE TABLE "score_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"scan_id" uuid,
	"overall_score" integer NOT NULL,
	"readiness_level" integer NOT NULL,
	"sub_scores" jsonb NOT NULL,
	"ai_citation_count" integer DEFAULT 0 NOT NULL,
	"snapshot_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roi_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"baseline_snapshot_id" uuid,
	"latest_snapshot_id" uuid,
	"report_data" jsonb NOT NULL,
	"format" text DEFAULT 'pdf' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roi_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"milestone_type" text NOT NULL,
	"milestone_data" jsonb NOT NULL,
	"snapshot_id" uuid,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_citation_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"snapshot_id" uuid,
	"platform" text NOT NULL,
	"citation_url" text NOT NULL,
	"citation_context" text,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"encrypted_secret" text NOT NULL,
	"events" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"response_status" integer,
	"response_body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_project_id_monitoring_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."monitoring_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_reports" ADD CONSTRAINT "roi_reports_project_id_monitoring_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."monitoring_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_reports" ADD CONSTRAINT "roi_reports_baseline_snapshot_id_score_snapshots_id_fk" FOREIGN KEY ("baseline_snapshot_id") REFERENCES "public"."score_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_reports" ADD CONSTRAINT "roi_reports_latest_snapshot_id_score_snapshots_id_fk" FOREIGN KEY ("latest_snapshot_id") REFERENCES "public"."score_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_milestones" ADD CONSTRAINT "roi_milestones_project_id_monitoring_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."monitoring_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roi_milestones" ADD CONSTRAINT "roi_milestones_snapshot_id_score_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."score_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_citation_tracking" ADD CONSTRAINT "ai_citation_tracking_project_id_monitoring_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."monitoring_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_citation_tracking" ADD CONSTRAINT "ai_citation_tracking_snapshot_id_score_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."score_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_score_snapshots_project_created" ON "score_snapshots" USING btree ("project_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_score_snapshots_baseline" ON "score_snapshots" USING btree ("project_id","created_at") WHERE "score_snapshots"."snapshot_type" = 'baseline';--> statement-breakpoint
CREATE INDEX "idx_score_snapshots_scan" ON "score_snapshots" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "idx_roi_reports_project_created" ON "roi_reports" USING btree ("project_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_roi_milestones_project_triggered" ON "roi_milestones" USING btree ("project_id","triggered_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_roi_milestones_type" ON "roi_milestones" USING btree ("project_id","milestone_type");--> statement-breakpoint
CREATE INDEX "idx_ai_citation_tracking_project_discovered" ON "ai_citation_tracking" USING btree ("project_id","discovered_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_ai_citation_tracking_platform" ON "ai_citation_tracking" USING btree ("project_id","platform","discovered_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_ai_citation_tracking_url" ON "ai_citation_tracking" USING btree ("citation_url");--> statement-breakpoint
CREATE INDEX "idx_webhook_endpoints_user" ON "webhook_endpoints" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_endpoints_user_active" ON "webhook_endpoints" USING btree ("user_id") WHERE "webhook_endpoints"."active" = true;--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_endpoint" ON "webhook_deliveries" USING btree ("endpoint_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_status" ON "webhook_deliveries" USING btree ("status") WHERE "webhook_deliveries"."status" = 'failed';--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_created" ON "webhook_deliveries" USING btree ("created_at" DESC);
