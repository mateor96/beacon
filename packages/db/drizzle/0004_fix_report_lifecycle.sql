ALTER TABLE "scans" ADD COLUMN "fix_statuses" jsonb;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "report_status" text;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "report_error" text;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "report_job_id" text;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "report_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "report_file_size_bytes" integer;
