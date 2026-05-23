-- Create waitlist_signups table (schema defined but never migrated)
CREATE TABLE IF NOT EXISTS "waitlist_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"company_name" text,
	"website_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"confirm_token" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"consent_given_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'landing',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Indexes for waitlist_signups
CREATE UNIQUE INDEX IF NOT EXISTS "idx_waitlist_email" ON "waitlist_signups" USING btree ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_waitlist_confirm_token" ON "waitlist_signups" USING btree ("confirm_token");
--> statement-breakpoint

-- Missing partial index on scans.expires_at (defined in schema, never migrated)
CREATE INDEX IF NOT EXISTS "idx_scans_expires_at" ON "scans" USING btree ("expires_at") WHERE "expires_at" IS NOT NULL;
