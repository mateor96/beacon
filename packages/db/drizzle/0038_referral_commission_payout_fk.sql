ALTER TABLE "referral_commissions" ADD COLUMN "payout_id" uuid;--> statement-breakpoint
ALTER TABLE "referral_commissions" ADD CONSTRAINT "referral_commissions_payout_id_referral_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."referral_payouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_referral_commissions_payout" ON "referral_commissions" USING btree ("payout_id");
