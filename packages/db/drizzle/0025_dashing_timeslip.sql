ALTER TABLE "ai_source_attributions" ADD COLUMN "matched_page_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_source_attributions" ADD COLUMN "source_type" text DEFAULT 'structured' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_ai_source_attributions_matched_page" ON "ai_source_attributions" USING btree ("matched_page_id");