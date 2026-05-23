ALTER TABLE "competitors" ADD COLUMN "industry" text;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_competitors_project_domain_uniq" ON "competitors" USING btree ("project_id","domain") WHERE "competitors"."domain" IS NOT NULL;
