CREATE TABLE "affiliates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"company_name" text,
	"payout_details" jsonb,
	"terms_version" text,
	"terms_accepted_at" timestamp with time zone,
	"rejection_reason" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversion_id" uuid NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"type" text NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"stripe_invoice_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_link_id" uuid,
	"affiliate_id" uuid NOT NULL,
	"referred_user_id" uuid,
	"attribution_method" text DEFAULT 'cookie' NOT NULL,
	"status" text DEFAULT 'signup' NOT NULL,
	"converted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_payment_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text,
	"click_count" bigint DEFAULT 0 NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"processing_notes" text,
	"stripe_payout_id" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_commissions" ADD CONSTRAINT "referral_commissions_conversion_id_referral_conversions_id_fk" FOREIGN KEY ("conversion_id") REFERENCES "public"."referral_conversions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_commissions" ADD CONSTRAINT "referral_commissions_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_conversions" ADD CONSTRAINT "referral_conversions_referral_link_id_referral_links_id_fk" FOREIGN KEY ("referral_link_id") REFERENCES "public"."referral_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_conversions" ADD CONSTRAINT "referral_conversions_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_conversions" ADD CONSTRAINT "referral_conversions_referred_user_id_profiles_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_payouts" ADD CONSTRAINT "referral_payouts_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_affiliates_user_uniq" ON "affiliates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_affiliates_status" ON "affiliates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_referral_commissions_affiliate_status" ON "referral_commissions" USING btree ("affiliate_id","status");--> statement-breakpoint
CREATE INDEX "idx_referral_commissions_conversion" ON "referral_commissions" USING btree ("conversion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_referral_commissions_invoice_uniq" ON "referral_commissions" USING btree ("stripe_invoice_id") WHERE "referral_commissions"."stripe_invoice_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_referral_conversions_user_uniq" ON "referral_conversions" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "idx_referral_conversions_affiliate" ON "referral_conversions" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "idx_referral_conversions_status" ON "referral_conversions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_referral_links_code_uniq" ON "referral_links" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_referral_links_affiliate" ON "referral_links" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "idx_referral_payouts_affiliate_status" ON "referral_payouts" USING btree ("affiliate_id","status");--> statement-breakpoint
CREATE INDEX "idx_referral_payouts_status" ON "referral_payouts" USING btree ("status");