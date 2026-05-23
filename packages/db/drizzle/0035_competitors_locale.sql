ALTER TABLE "competitors" ADD COLUMN "locale_id" uuid;--> statement-breakpoint
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_locale_id_locales_id_fk" FOREIGN KEY ("locale_id") REFERENCES "public"."locales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_competitors_project_locale" ON "competitors" USING btree ("project_id","locale_id");
