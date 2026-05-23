CREATE TABLE "report_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"share_token" text NOT NULL,
	"password_hash" text,
	"expires_at" timestamp with time zone DEFAULT (NOW() + INTERVAL '30 days') NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_accessed_at" timestamp with time zone,
	"access_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_report_id_scans_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_report_shares_token_uniq" ON "report_shares" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "idx_report_shares_user_active" ON "report_shares" USING btree ("user_id","is_active","expires_at");--> statement-breakpoint
CREATE INDEX "idx_report_shares_report" ON "report_shares" USING btree ("report_id");
