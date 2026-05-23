CREATE TABLE "cms_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cms_type" text NOT NULL,
	"site_url" text NOT NULL,
	"label" text,
	"encrypted_credentials" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "generated_fixes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"fix_type" text NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"generation_metadata" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deployment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fix_id" uuid NOT NULL,
	"cms_connection_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"error_code" text,
	"rollback_data" jsonb,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fix_validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"scan_id" uuid,
	"status" text NOT NULL,
	"results" jsonb NOT NULL,
	"validated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cms_connections" ADD CONSTRAINT "cms_connections_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_fixes" ADD CONSTRAINT "generated_fixes_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_fixes" ADD CONSTRAINT "generated_fixes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_attempts" ADD CONSTRAINT "deployment_attempts_fix_id_generated_fixes_id_fk" FOREIGN KEY ("fix_id") REFERENCES "public"."generated_fixes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_attempts" ADD CONSTRAINT "deployment_attempts_cms_connection_id_cms_connections_id_fk" FOREIGN KEY ("cms_connection_id") REFERENCES "public"."cms_connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fix_validations" ADD CONSTRAINT "fix_validations_deployment_id_deployment_attempts_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployment_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fix_validations" ADD CONSTRAINT "fix_validations_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cms_connections_user" ON "cms_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cms_connections_user_active" ON "cms_connections" USING btree ("user_id","cms_type") WHERE "cms_connections"."is_active" = true AND "cms_connections"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cms_connections_active_per_site" ON "cms_connections" USING btree ("user_id","cms_type","site_url") WHERE "cms_connections"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_generated_fixes_scan_type_version" ON "generated_fixes" USING btree ("scan_id","fix_type","version") WHERE "generated_fixes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_generated_fixes_scan" ON "generated_fixes" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "idx_generated_fixes_user" ON "generated_fixes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_generated_fixes_fix_type" ON "generated_fixes" USING btree ("fix_type");--> statement-breakpoint
CREATE INDEX "idx_generated_fixes_status" ON "generated_fixes" USING btree ("status") WHERE "generated_fixes"."status" != 'deployed';--> statement-breakpoint
CREATE INDEX "idx_generated_fixes_user_type_created" ON "generated_fixes" USING btree ("user_id","fix_type","created_at" DESC NULLS LAST) WHERE "generated_fixes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_generated_fixes_content_hash" ON "generated_fixes" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_deployment_attempts_fix" ON "deployment_attempts" USING btree ("fix_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_deployment_attempts_cms" ON "deployment_attempts" USING btree ("cms_connection_id");--> statement-breakpoint
CREATE INDEX "idx_deployment_attempts_status" ON "deployment_attempts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_deployment_attempts_active" ON "deployment_attempts" USING btree ("started_at") WHERE "deployment_attempts"."status" IN ('pending', 'in_progress');--> statement-breakpoint
CREATE UNIQUE INDEX "uq_deployment_attempts_idempotency" ON "deployment_attempts" USING btree ("idempotency_key") WHERE "deployment_attempts"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_fix_validations_deployment" ON "fix_validations" USING btree ("deployment_id");--> statement-breakpoint
CREATE INDEX "idx_fix_validations_scan" ON "fix_validations" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "idx_fix_validations_status" ON "fix_validations" USING btree ("status") WHERE "fix_validations"."status" != 'pass';--> statement-breakpoint
CREATE INDEX "idx_fix_validations_validated" ON "fix_validations" USING btree ("validated_at" DESC NULLS LAST);--> statement-breakpoint
COMMENT ON COLUMN "fix_validations"."scan_id" IS 'Post-deployment validation re-scan (a NEW scans row created AFTER the fix is deployed to verify it worked end-to-end). NOT the original scan that triggered fix generation. Nullable + ON DELETE SET NULL because the re-scan inherits the standard 30-day TTL and the validation row must survive it. See decision D17 in the #223 masterplan.';
