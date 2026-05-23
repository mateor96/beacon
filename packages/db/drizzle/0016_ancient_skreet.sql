CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"recipient_email" text NOT NULL,
	"template" text NOT NULL,
	"category" text NOT NULL,
	"subject" text NOT NULL,
	"idempotency_key" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_message_id" text,
	"error_message" text,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_email_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_email_preferences" ADD CONSTRAINT "user_email_preferences_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_email_log_idempotency_key" ON "email_log" USING btree ("idempotency_key") WHERE "email_log"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_email_log_user_created" ON "email_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_email_log_status" ON "email_log" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_email_prefs_user_category" ON "user_email_preferences" USING btree ("user_id","category");