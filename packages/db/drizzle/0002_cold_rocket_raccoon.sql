ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription_events" DROP CONSTRAINT "subscription_events_user_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "site_crawl_pages" DROP CONSTRAINT "site_crawl_pages_scan_id_scans_id_fk";
--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "anonymous_scans" ADD COLUMN "expires_at" date DEFAULT (CURRENT_DATE + 30)::date NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "benchmark_groups" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "site_crawls" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "monitoring_projects" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "monitoring_results" ADD COLUMN "expires_at" timestamp with time zone DEFAULT NOW() + INTERVAL '90 days';--> statement-breakpoint
ALTER TABLE "monitoring_schedules" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "html_content_expires_at" timestamp with time zone DEFAULT NOW() + INTERVAL '72 hours';--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "expires_at" timestamp with time zone DEFAULT NOW() + INTERVAL '30 days';--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_crawl_pages" ADD CONSTRAINT "site_crawl_pages_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;