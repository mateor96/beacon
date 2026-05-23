import type { DbClient, PayoutStatus } from "@beacon/db";
import { referralQueries } from "@beacon/db";

const MIN_PAYOUT_CENTS = 5000; // 50.00 EUR

export interface RequestPayoutParams {
	affiliateId: string;
	amountCents?: number;
}

export type RequestPayoutResult =
	| { status: "requested"; payoutId: string; amountCents: number }
	| { status: "below_minimum"; unpaidBalanceCents: number; minimumCents: number }
	| { status: "no_balance" }
	| { status: "pending_exists"; payoutId: string };

/**
 * Affiliate-initiated payout request. Uses the total unpaid commission
 * balance as the amount by default. Rejects when below 50 EUR or when a
 * pending payout already exists for this affiliate.
 */
export async function requestPayout(
	db: DbClient,
	params: RequestPayoutParams,
): Promise<RequestPayoutResult> {
	const pending = await referralQueries.listPayoutsForAffiliate(db, params.affiliateId);
	const openPayout = pending.find(
		(p) => p.status === "requested" || p.status === "approved" || p.status === "processing",
	);
	if (openPayout) return { status: "pending_exists", payoutId: openPayout.id };

	// Snapshot: pick every approved commission not already linked to a payout.
	// This set defines what this payout pays out; later-arriving commissions
	// (from the recurring-invoice cron) stay unlinked and flow into the NEXT
	// payout.
	const snapshot = await referralQueries.listCommissionsForAffiliate(db, params.affiliateId, {
		status: "approved",
		unlinkedOnly: true,
	});
	const snapshotAmount = snapshot.reduce((sum, c) => sum + c.amountCents, 0);
	if (snapshotAmount <= 0) return { status: "no_balance" };
	if (snapshotAmount < MIN_PAYOUT_CENTS) {
		return {
			status: "below_minimum",
			unpaidBalanceCents: snapshotAmount,
			minimumCents: MIN_PAYOUT_CENTS,
		};
	}

	const affiliate = await referralQueries.getAffiliateById(db, params.affiliateId);
	const method = affiliate?.payoutDetails?.method ?? "manual";
	const created = await referralQueries.createPayout(db, {
		affiliateId: params.affiliateId,
		amountCents: snapshotAmount,
		method,
		status: "requested",
	});
	// Link each snapshotted commission to this payout. Done sequentially
	// — low volume per affiliate + keeps per-row error isolation.
	for (const c of snapshot) {
		await referralQueries.updateCommission(db, c.id, { payoutId: created.id });
	}
	return { status: "requested", payoutId: created.id, amountCents: created.amountCents };
}

export type TransitionPayoutResult =
	| { status: "transitioned"; from: PayoutStatus; to: PayoutStatus }
	| { status: "not_found" }
	| { status: "invalid_transition"; from: PayoutStatus; to: PayoutStatus };

const ALLOWED_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
	requested: ["approved", "failed"],
	approved: ["processing", "failed"],
	processing: ["completed", "failed"],
	completed: [],
	failed: [],
};

/**
 * Admin-side status transition. Validates the move against the finite
 * state machine above; illegal transitions return `invalid_transition`.
 * When moving to `completed` all associated commissions flip to `paid`.
 */
export async function transitionPayout(
	db: DbClient,
	payoutId: string,
	to: PayoutStatus,
	opts: { processingNotes?: string; stripePayoutId?: string | null } = {},
): Promise<TransitionPayoutResult> {
	const payout = await referralQueries.getPayoutById(db, payoutId);
	if (!payout) return { status: "not_found" };
	const allowed = ALLOWED_TRANSITIONS[payout.status] ?? [];
	if (!allowed.includes(to)) {
		return { status: "invalid_transition", from: payout.status, to };
	}
	await referralQueries.updatePayout(db, payoutId, {
		status: to,
		processingNotes: opts.processingNotes ?? null,
		stripePayoutId: opts.stripePayoutId ?? payout.stripePayoutId,
		processedAt: to === "completed" ? new Date() : payout.processedAt,
	});
	if (to === "completed") {
		// Flip only commissions that belong to THIS payout (#476).
		const commissions = await referralQueries.listCommissionsByPayoutId(db, payoutId);
		for (const c of commissions) {
			await referralQueries.updateCommission(db, c.id, { status: "paid" });
		}
	}
	if (to === "failed") {
		// Release the link so commissions flow into the next payout.
		const commissions = await referralQueries.listCommissionsByPayoutId(db, payoutId);
		for (const c of commissions) {
			await referralQueries.updateCommission(db, c.id, { payoutId: null });
		}
	}
	return { status: "transitioned", from: payout.status, to };
}

export { MIN_PAYOUT_CENTS };
