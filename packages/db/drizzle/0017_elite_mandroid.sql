CREATE TABLE "public_audit_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" text NOT NULL,
	"fingerprint" text,
	"url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "public_audit_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"overall_score" integer NOT NULL,
	"model_scores" jsonb NOT NULL,
	"summary" text,
	"raw_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_conversion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"lead_id" uuid,
	"event_type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"email" text NOT NULL,
	"company_name" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"converted_to_signup" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "public_audit_results" ADD CONSTRAINT "public_audit_results_request_id_public_audit_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."public_audit_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_conversion_events" ADD CONSTRAINT "public_conversion_events_request_id_public_audit_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."public_audit_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_conversion_events" ADD CONSTRAINT "public_conversion_events_lead_id_public_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."public_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_leads" ADD CONSTRAINT "public_leads_request_id_public_audit_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."public_audit_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_public_audit_requests_url" ON "public_audit_requests" USING btree ("url");--> statement-breakpoint
CREATE INDEX "idx_public_audit_requests_ip_hash" ON "public_audit_requests" USING btree ("ip_hash");--> statement-breakpoint
CREATE INDEX "idx_public_audit_requests_ip_hash_created" ON "public_audit_requests" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "idx_public_audit_requests_status_pending" ON "public_audit_requests" USING btree ("status") WHERE "public_audit_requests"."status" != 'completed';--> statement-breakpoint
CREATE UNIQUE INDEX "idx_public_audit_results_request_id" ON "public_audit_results" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_public_conversion_events_request_created" ON "public_conversion_events" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_public_conversion_events_event_type_created" ON "public_conversion_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_public_leads_request_id" ON "public_leads" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_public_leads_email" ON "public_leads" USING btree ("email");