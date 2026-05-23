CREATE TABLE "guarantee_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"subscription_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"baseline_snapshot_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"resolution_notes" text,
	"stripe_refund_id" text,
	"terms_version" text,
	"terms_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guarantee_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"milestone_day" integer NOT NULL,
	"scan_id" uuid,
	"baseline_score" integer NOT NULL,
	"current_score" integer NOT NULL,
	"delta" integer NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guarantee_claims" ADD CONSTRAINT "guarantee_claims_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantee_claims" ADD CONSTRAINT "guarantee_claims_baseline_snapshot_id_scans_id_fk" FOREIGN KEY ("baseline_snapshot_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantee_milestones" ADD CONSTRAINT "guarantee_milestones_claim_id_guarantee_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."guarantee_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantee_milestones" ADD CONSTRAINT "guarantee_milestones_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_guarantee_claims_user_started" ON "guarantee_claims" USING btree ("user_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_guarantee_claims_subscription_uniq" ON "guarantee_claims" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_guarantee_claims_status" ON "guarantee_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_guarantee_claims_started_at" ON "guarantee_claims" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_guarantee_milestones_claim_day_uniq" ON "guarantee_milestones" USING btree ("claim_id","milestone_day");--> statement-breakpoint
CREATE INDEX "idx_guarantee_milestones_day" ON "guarantee_milestones" USING btree ("milestone_day");