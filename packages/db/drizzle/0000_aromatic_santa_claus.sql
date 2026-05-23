CREATE TABLE "alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"channel" text NOT NULL,
	"config" jsonb DEFAULT '{}',
	"enabled" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "anonymous_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" text NOT NULL,
	"scan_count" integer DEFAULT 1 NOT NULL,
	"scan_date" date DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"scopes" text[] DEFAULT '{"scan","read"}',
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "subscription_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "benchmark_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"urls" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "site_crawl_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crawl_id" uuid NOT NULL,
	"scan_id" uuid,
	"url" text NOT NULL,
	"depth" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_crawls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"root_url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"pages_found" integer DEFAULT 0,
	"pages_scanned" integer DEFAULT 0,
	"avg_score" integer,
	"weakest_pages" jsonb,
	"started_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "monitoring_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"website_url" text NOT NULL,
	"brand_keywords" text[] NOT NULL,
	"competitor_keywords" text[],
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "monitoring_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"category" text,
	"auto_generated" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "monitoring_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" uuid NOT NULL,
	"engine" text NOT NULL,
	"response_text" text NOT NULL,
	"brand_mentioned" boolean NOT NULL,
	"brand_position" integer,
	"urls_cited" text[],
	"our_url_cited" boolean NOT NULL,
	"sentiment" text,
	"checked_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "monitoring_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"frequency" text NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"last_run_at" timestamp with time zone,
	"enabled" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"daily_scans_used" integer DEFAULT 0 NOT NULL,
	"monthly_scans_used" integer DEFAULT 0 NOT NULL,
	"scan_reset_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"url" text NOT NULL,
	"score" integer NOT NULL,
	"readiness_level" integer NOT NULL,
	"level_scores" jsonb NOT NULL,
	"checks" jsonb NOT NULL,
	"fixes" jsonb DEFAULT '{}',
	"ai_analysis" text,
	"citation_ai_analysis" text,
	"report_texts" jsonb,
	"html_content" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"processing_duration_ms" integer,
	"error_message" text,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark_groups" ADD CONSTRAINT "benchmark_groups_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_crawl_pages" ADD CONSTRAINT "site_crawl_pages_crawl_id_site_crawls_id_fk" FOREIGN KEY ("crawl_id") REFERENCES "public"."site_crawls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_crawl_pages" ADD CONSTRAINT "site_crawl_pages_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_crawls" ADD CONSTRAINT "site_crawls_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_projects" ADD CONSTRAINT "monitoring_projects_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_prompts" ADD CONSTRAINT "monitoring_prompts_project_id_monitoring_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."monitoring_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_results" ADD CONSTRAINT "monitoring_results_prompt_id_monitoring_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."monitoring_prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_schedules" ADD CONSTRAINT "monitoring_schedules_project_id_monitoring_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."monitoring_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_anon_date" ON "anonymous_scans" USING btree ("scan_date");--> statement-breakpoint
CREATE INDEX "idx_api_keys_prefix" ON "api_keys" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "idx_api_keys_user" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user" ON "audit_logs" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_subscription_events_user" ON "subscription_events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_site_crawl_pages_crawl" ON "site_crawl_pages" USING btree ("crawl_id","status");--> statement-breakpoint
CREATE INDEX "idx_site_crawls_user" ON "site_crawls" USING btree ("user_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_monitoring_results_checked" ON "monitoring_results" USING btree ("checked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_monitoring_results_prompt" ON "monitoring_results" USING btree ("prompt_id","checked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_monitoring_schedules_next" ON "monitoring_schedules" USING btree ("next_run_at") WHERE "monitoring_schedules"."enabled" = true;--> statement-breakpoint
CREATE INDEX "idx_profiles_stripe" ON "profiles" USING btree ("stripe_customer_id") WHERE "profiles"."stripe_customer_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_scans_user_scanned" ON "scans" USING btree ("user_id","scanned_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_scans_url" ON "scans" USING btree ("url");--> statement-breakpoint
CREATE INDEX "idx_scans_status" ON "scans" USING btree ("status") WHERE "scans"."status" != 'completed';