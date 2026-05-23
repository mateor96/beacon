DROP INDEX "idx_cited_pages_url";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cited_pages_url_uniq" ON "cited_pages" USING btree ("url");