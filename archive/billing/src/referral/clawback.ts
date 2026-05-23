import type { DbClient } from "@beacon/db";
import { referralQueries } from "@beacon/db";

export type ClawbackReason = "refund" | "chargeback";

export interface ClawbackParams {
	stripeInvoiceId: string;
	reason: ClawbackReason;
}

export interface ClawbackResult {
	commissionsClawedBack: number;
	totalClawbackCents: number;
	affiliateIds: string[];
}

/**
 * Reverses every commission tied to the given Stripe invoice (#299).
 *
 * Idempotent: commissions already in `clawed_back` are skipped. Returns
 * a per-affiliate summary that the caller can use to:
 *  - decrement affiliate balances (the existing getUnpaidBalanceCents
 *    helper already excludes clawed_back rows from the sum, so no
 *    explicit subtraction is needed).
 *  - block payouts on negative balance (caller policy).
 *  - send notifications via sendReferralEmail (kept out of this fn so
 *    it stays deterministic for testing).
 */
export async function clawbackCommissionsByInvoice(
	db: DbClient,
	params: ClawbackParams,
): Promise<ClawbackResult> {
	const commissions = await referralQueries.listCommissionsByInvoiceId(db, params.stripeInvoiceId);
	if (commissions.length === 0) {
		return { commissionsClawedBack: 0, totalClawbackCents: 0, affiliateIds: [] };
	}

	const affiliateIds = new Set<string>();
	let total = 0;
	let updated = 0;
	const note = `Clawback: ${params.reason} (Invoice ${params.stripeInvoiceId})`;

	for (const c of commissions) {
		if (c.status === "clawed_back") continue;
		await referralQueries.updateCommission(db, c.id, {
			status: "clawed_back",
			notes: note,
		});
		affiliateIds.add(c.affiliateId);
		total += c.amountCents;
		updated += 1;
	}

	return {
		commissionsClawedBack: updated,
		totalClawbackCents: total,
		affiliateIds: [...affiliateIds],
	};
}
