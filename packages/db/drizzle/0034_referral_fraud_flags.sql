CREATE TABLE "referral_fraud_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"conversion_id" uuid,
	"rule" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referral_fraud_flags" ADD CONSTRAINT "referral_fraud_flags_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_fraud_flags" ADD CONSTRAINT "referral_fraud_flags_conversion_id_referral_conversions_id_fk" FOREIGN KEY ("conversion_id") REFERENCES "public"."referral_conversions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_referral_fraud_flags_affiliate" ON "referral_fraud_flags" USING btree ("affiliate_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_referral_fraud_flags_rule" ON "referral_fraud_flags" USING btree ("rule");
