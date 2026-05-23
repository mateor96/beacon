CREATE TABLE "citation_url_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"client_page_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "citation_page_mappings" ADD COLUMN "match_confidence" integer;--> statement-breakpoint
ALTER TABLE "citation_url_aliases" ADD CONSTRAINT "citation_url_aliases_client_page_id_site_crawl_pages_id_fk" FOREIGN KEY ("client_page_id") REFERENCES "public"."site_crawl_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_citation_url_aliases_url" ON "citation_url_aliases" USING btree ("url");--> statement-breakpoint
CREATE INDEX "idx_citation_url_aliases_client_page" ON "citation_url_aliases" USING btree ("client_page_id");