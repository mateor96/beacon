CREATE TABLE "csv_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"columns" jsonb,
	"date_from" timestamp with time zone,
	"date_to" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"row_count" bigint DEFAULT 0 NOT NULL,
	"file_bytes" bigint DEFAULT 0 NOT NULL,
	"storage_key" text,
	"download_url" text,
	"url_expires_at" timestamp with time zone,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "csv_exports" ADD CONSTRAINT "csv_exports_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_csv_exports_user_created" ON "csv_exports" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_csv_exports_status" ON "csv_exports" USING btree ("status");
