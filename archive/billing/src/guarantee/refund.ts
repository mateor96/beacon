import type { DbClient } from "@beacon/db";
import { guaranteeQueries, profileQueries } from "@beacon/db";
import type Stripe from "stripe";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProcessRefundResult {
	refunded: boolean;
	refundIds: string[];
	totalAmountCents: number;
	skippedInvoices: number;
	error?: string;
}

/**
 * Create Stripe refunds for every paid invoice within the claim's 90-day
 * window, cancel the subscription, and transition the claim to `refunded`.
 *
 * Idempotency: we write the last refund ID onto the claim. Re-running against
 * a claim already in `refunded` state short-circuits as a no-op.
 */
export async function processGuaranteeRefund(
	db: DbClient,
	stripe: Stripe,
	claimId: string,
): Promise<ProcessRefundResult> {
	const claim = await guaranteeQueries.getClaimById(db, claimId);
	if (!claim) {
		return {
			refunded: false,
			refundIds: [],
			totalAmountCents: 0,
			skippedInvoices: 0,
			error: "claim_not_found",
		};
	}
	if (claim.status === "refunded") {
		return {
			refunded: true,
			refundIds: claim.stripeRefundId ? [claim.stripeRefundId] : [],
			totalAmountCents: 0,
			skippedInvoices: 0,
		};
	}
	if (claim.status !== "refund_requested" && claim.status !== "eligible_for_refund") {
		return {
			refunded: false,
			refundIds: [],
			totalAmountCents: 0,
			skippedInvoices: 0,
			error: `claim status ${claim.status} is not refundable`,
		};
	}
	if (!claim.userId) {
		return {
			refunded: false,
			refundIds: [],
			totalAmountCents: 0,
			skippedInvoices: 0,
			error: "claim has no user",
		};
	}

	const profile = await profileQueries.getById(db, claim.userId);
	if (!profile?.stripeCustomerId) {
		return {
			refunded: false,
			refundIds: [],
			totalAmountCents: 0,
			skippedInvoices: 0,
			error: "profile has no stripe customer",
		};
	}

	const windowStart = Math.floor(claim.startedAt.getTime() / 1000);
	const windowEnd = Math.floor((claim.startedAt.getTime() + 90 * DAY_MS) / 1000);

	const refundIds: string[] = [];
	let totalAmountCents = 0;
	let skipped = 0;

	try {
		const invoices = await stripe.invoices.list({
			customer: profile.stripeCustomerId,
			subscription: claim.subscriptionId,
			status: "paid",
			created: { gte: windowStart, lte: windowEnd },
			limit: 100,
		});

		for (const inv of invoices.data) {
			// `payment_intent` is present in webhook payloads but stripped from
			// the SDK's Invoice type in v20+. Read via unknown cast.
			const rawInv = inv as unknown as Record<string, unknown>;
			const rawPi = rawInv.payment_intent;
			const paymentIntent = typeof rawPi === "string" ? rawPi : null;
			if (!paymentIntent) {
				skipped++;
				continue;
			}
			const refund = await stripe.refunds.create({
				payment_intent: paymentIntent,
				reason: "requested_by_customer",
				metadata: { claimId, invoiceId: inv.id ?? "" },
			});
			refundIds.push(refund.id);
			totalAmountCents += refund.amount ?? 0;
		}

		try {
			await stripe.subscriptions.cancel(claim.subscriptionId, {
				invoice_now: false,
				prorate: false,
			});
		} catch (cancelErr) {
			// Refund succeeded but cancellation failed — log and continue.
			// Claim still marks as refunded since the money is back.
			console.warn("[guarantee] Failed to cancel subscription after refund", {
				claimId,
				subscriptionId: claim.subscriptionId,
				error: cancelErr instanceof Error ? cancelErr.message : String(cancelErr),
			});
		}

		await guaranteeQueries.updateClaim(db, claimId, {
			status: "refunded",
			stripeRefundId: refundIds[refundIds.length - 1] ?? null,
			resolutionNotes: `refunded ${refundIds.length} invoice(s) totaling ${totalAmountCents}c`,
		});

		return { refunded: true, refundIds, totalAmountCents, skippedInvoices: skipped };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			refunded: false,
			refundIds,
			totalAmountCents,
			skippedInvoices: skipped,
			error: message,
		};
	}
}
