CREATE TABLE "locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" text NOT NULL,
	"language_code" text NOT NULL,
	"display_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"locale_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"locale_id" uuid NOT NULL,
	"key" text NOT NULL,
	"content" text NOT NULL,
	"category" text,
	"variables" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "locale_id" uuid;--> statement-breakpoint
ALTER TABLE "domain_locales" ADD CONSTRAINT "domain_locales_domain_id_monitoring_projects_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."monitoring_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_locales" ADD CONSTRAINT "domain_locales_locale_id_locales_id_fk" FOREIGN KEY ("locale_id") REFERENCES "public"."locales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_locale_id_locales_id_fk" FOREIGN KEY ("locale_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_locale_id_locales_id_fk" FOREIGN KEY ("locale_id") REFERENCES "public"."locales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_locales_country_language_uniq" ON "locales" USING btree ("country_code","language_code");--> statement-breakpoint
CREATE INDEX "idx_locales_active" ON "locales" USING btree ("is_active") WHERE "locales"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_domain_locales_pair_uniq" ON "domain_locales" USING btree ("domain_id","locale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_domain_locales_primary_uniq" ON "domain_locales" USING btree ("domain_id") WHERE "domain_locales"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "idx_domain_locales_locale" ON "domain_locales" USING btree ("locale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_prompt_templates_locale_key_uniq" ON "prompt_templates" USING btree ("locale_id","key");--> statement-breakpoint
CREATE INDEX "idx_prompt_templates_locale" ON "prompt_templates" USING btree ("locale_id");--> statement-breakpoint
CREATE INDEX "idx_scans_user_locale" ON "scans" USING btree ("user_id","locale_id");--> statement-breakpoint
INSERT INTO "locales" ("country_code", "language_code", "display_name") VALUES
	('DE', 'de', 'Deutsch (Deutschland)'),
	('AT', 'de', 'Deutsch (Oesterreich)'),
	('CH', 'de', 'Deutsch (Schweiz)'),
	('US', 'en', 'English (United States)'),
	('GB', 'en', 'English (United Kingdom)')
ON CONFLICT ("country_code", "language_code") DO NOTHING;
