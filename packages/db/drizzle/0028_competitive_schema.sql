CREATE TABLE "competitor_scan_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" uuid NOT NULL,
	"scan_id" uuid,
	"readiness_score" integer,
	"json_ld_score" integer,
	"llms_txt_score" integer,
	"agents_md_score" integer,
	"citation_count" integer DEFAULT 0 NOT NULL,
	"details" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_score_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" uuid,
	"domain_key" text NOT NULL,
	"score" integer NOT NULL,
	"citation_count" bigint DEFAULT 0 NOT NULL,
	"trend" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitor_scan_results" ADD CONSTRAINT "competitor_scan_results_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_scan_results" ADD CONSTRAINT "competitor_scan_results_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_score_history" ADD CONSTRAINT "competitor_score_history_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_competitor_scan_results_competitor" ON "competitor_scan_results" USING btree ("competitor_id","scanned_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_competitor_scan_results_status" ON "competitor_scan_results" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_competitor_score_history_key_time" ON "competitor_score_history" USING btree ("domain_key","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_competitor_score_history_competitor" ON "competitor_score_history" USING btree ("competitor_id");