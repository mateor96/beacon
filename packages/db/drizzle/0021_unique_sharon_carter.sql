CREATE TABLE "citation_page_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"citation_id" uuid NOT NULL,
	"cited_page_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"context_snippet" text,
	"match_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citation_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_page_id" uuid NOT NULL,
	"audit_id" uuid NOT NULL,
	"snapshot_type" text NOT NULL,
	"total_citations" integer DEFAULT 0 NOT NULL,
	"model_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"model_name" text NOT NULL,
	"query_text" text NOT NULL,
	"raw_response" text NOT NULL,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cited_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text,
	"domain" text NOT NULL,
	"client_page_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "citation_page_mappings" ADD CONSTRAINT "citation_page_mappings_citation_id_citations_id_fk" FOREIGN KEY ("citation_id") REFERENCES "public"."citations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation_page_mappings" ADD CONSTRAINT "citation_page_mappings_cited_page_id_cited_pages_id_fk" FOREIGN KEY ("cited_page_id") REFERENCES "public"."cited_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation_snapshots" ADD CONSTRAINT "citation_snapshots_client_page_id_site_crawl_pages_id_fk" FOREIGN KEY ("client_page_id") REFERENCES "public"."site_crawl_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation_snapshots" ADD CONSTRAINT "citation_snapshots_audit_id_scans_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citations" ADD CONSTRAINT "citations_audit_id_scans_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cited_pages" ADD CONSTRAINT "cited_pages_client_page_id_site_crawl_pages_id_fk" FOREIGN KEY ("client_page_id") REFERENCES "public"."site_crawl_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_citation_page_mappings_citation" ON "citation_page_mappings" USING btree ("citation_id");--> statement-breakpoint
CREATE INDEX "idx_citation_page_mappings_cited_page" ON "citation_page_mappings" USING btree ("cited_page_id");--> statement-breakpoint
CREATE INDEX "idx_citation_page_mappings_match_type" ON "citation_page_mappings" USING btree ("match_type");--> statement-breakpoint
CREATE INDEX "idx_citation_snapshots_client_page" ON "citation_snapshots" USING btree ("client_page_id","captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_citation_snapshots_audit" ON "citation_snapshots" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "idx_citation_snapshots_type" ON "citation_snapshots" USING btree ("client_page_id","snapshot_type","captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_citation_snapshots_captured" ON "citation_snapshots" USING btree ("captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_citations_audit" ON "citations" USING btree ("audit_id","extracted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_citations_model" ON "citations" USING btree ("model_name","extracted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_cited_pages_url" ON "cited_pages" USING btree ("url");--> statement-breakpoint
CREATE INDEX "idx_cited_pages_domain" ON "cited_pages" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_cited_pages_client_page" ON "cited_pages" USING btree ("client_page_id");