import type { DbClient } from "@beacon/db";
import { guaranteeQueries, scanQueries } from "@beacon/db";
import type { PlanName } from "@beacon/shared";
import type Stripe from "stripe";
import { checkGuaranteeEligibility } from "./eligibility.js";
import type { GuaranteeRuleId } from "./rules.js";
import { resolveBaselineUrl } from "./url-resolver.js";

/**
 * Retention for the baseline scan row. The 90-day comparison worker (#229)
 * needs to re-compare scores after 90 days; keep the row well beyond the
 * guarantee window so the default 30-day `expiresAt` cleanup can't null
 * out `guarantee_claims.baseline_snapshot_id` via its ON DELETE SET NULL FK.
 */
const BASELINE_SCAN_RETENTION_DAYS = 120;

export interface ActivateGuaranteeParams {
	userId: string;
	plan: PlanName;
	/** Plan the user held before the activating event (null for new signups). */
	previousPlan?: PlanName | null;
	subscriptionId: string;
	stripeCustomerId?: string | null;
	/** Optional URL passed from Stripe checkout session metadata. */
	metadataUrl?: string | null;
	/** Event timestamp (Stripe event.created * 1000) used as the 90-day anchor. */
	startedAt?: Date;
	/** Optional Stripe client for the DACH-region rule. */
	stripe?: Stripe;
	/**
	 * Version of the guarantee terms the user accepted at checkout (#278).
	 * Null/undefined = not accepted; callers that require acceptance should
	 * handle the returned `terms_not_accepted` status.
	 */
	termsVersion?: string | null;
}

export type ActivateGuaranteeResult =
	| { status: "not_eligible"; reason: string; failedRule: GuaranteeRuleId | null }
	| { status: "deferred"; reason: "no_url" | "terms_not_accepted" }
	| { status: "duplicate" }
	| {
			status: "activated";
			claimId: string;
			scanId: string;
			url: string;
	  };

/**
 * Create a guarantee_claims row with its baseline scan for an activating
 * subscription. All DB writes happen inside the provided `tx`; the BullMQ
 * enqueue is intentionally left to the caller so it only fires after the
 * outer transaction commits.
 *
 * Ordering: claim row first (with `baselineSnapshotId: null`). If that
 * returns null the subscription is already claimed — bail without ever
 * allocating a scan row. Otherwise allocate the scan and update the claim
 * to point at it. This prevents orphan scan rows on concurrent webhook
 * retries.
 */
export async function activateGuaranteeBaseline(
	tx: DbClient,
	params: ActivateGuaranteeParams,
): Promise<ActivateGuaranteeResult> {
	const eligibility = await checkGuaranteeEligibility({
		tx,
		userId: params.userId,
		plan: params.plan,
		previousPlan: params.previousPlan ?? null,
		subscriptionId: params.subscriptionId,
		stripeCustomerId: params.stripeCustomerId ?? null,
		stripe: params.stripe,
	});
	if (!eligibility.eligible) {
		return {
			status: "not_eligible",
			reason: eligibility.reason ?? "ineligible",
			failedRule: eligibility.failedRule,
		};
	}

	// Terms acceptance is required to create a claim (#278). The webhook
	// threads this through from Stripe checkout metadata. If it is missing
	// we fall through to the deferred path so no half-formed claim is
	// persisted without legal acceptance.
	if (!params.termsVersion) {
		return { status: "deferred", reason: "terms_not_accepted" };
	}

	const url = await resolveBaselineUrl(tx, params.userId, params.metadataUrl);
	if (!url) {
		return { status: "deferred", reason: "no_url" };
	}

	const startedAt = params.startedAt ?? new Date();
	const claim = await guaranteeQueries.createClaimIdempotent(tx, {
		userId: params.userId,
		subscriptionId: params.subscriptionId,
		startedAt,
		status: "active",
		termsVersion: params.termsVersion,
		termsAcceptedAt: startedAt,
	});

	if (!claim) {
		// Duplicate — another webhook retry already claimed this subscription.
		return { status: "duplicate" };
	}

	// Allocate the baseline scan row. Extend retention to outlive the 90-day
	// comparison window; default 30 days would let cleanupQueries delete the
	// row and null-out the FK before the day-90 worker could read it.
	const expiresAt = new Date(Date.now() + BASELINE_SCAN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
	const scan = await scanQueries.create(tx, {
		userId: params.userId,
		url,
		score: 0,
		readinessLevel: 0,
		levelScores: {
			readability: null,
			interactivity: null,
			transactional: null,
		},
		checks: [],
		status: "pending",
		expiresAt,
	});

	await guaranteeQueries.updateClaim(tx, claim.id, {
		baselineSnapshotId: scan.id,
	});

	return { status: "activated", claimId: claim.id, scanId: scan.id, url };
}
