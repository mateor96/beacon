import type { DbClient, GuaranteeClaim, GuaranteeClaimStatus } from "@beacon/db";
import { guaranteeQueries } from "@beacon/db";

/**
 * Guarantee cancellation module (#285).
 *
 * Pure functions that transition a guarantee claim to cancelled or to an
 * admin-chosen status. Idempotent via terminal-state short-circuit — safe
 * under Stripe webhook retries.
 */

export const TERMINAL_STATUSES: readonly GuaranteeClaimStatus[] = [
	"refunded",
	"denied",
	"expired",
	"cancelled",
];

export function isTerminalStatus(status: GuaranteeClaimStatus): boolean {
	return TERMINAL_STATUSES.includes(status);
}

export interface CancelResult {
	cancelled: boolean;
	claimId?: string;
	skipped?: "not_found" | "already_terminal";
}

/**
 * Cancel the active guarantee claim for a given Stripe subscription.
 * No-op when the claim is missing or already in a terminal state. Returns
 * `{ cancelled, claimId?, skipped? }`.
 */
export async function cancelGuaranteeForSubscription(
	db: DbClient,
	subscriptionId: string,
	reason: string,
): Promise<CancelResult> {
	const claim = await guaranteeQueries.getClaimBySubscriptionId(db, subscriptionId);
	if (!claim) {
		return { cancelled: false, skipped: "not_found" };
	}
	if (isTerminalStatus(claim.status)) {
		return { cancelled: false, claimId: claim.id, skipped: "already_terminal" };
	}
	const previousNote = claim.resolutionNotes ? `${claim.resolutionNotes}; ` : "";
	await guaranteeQueries.updateClaim(db, claim.id, {
		status: "cancelled",
		resolutionNotes: `${previousNote}cancelled: ${reason}`,
	});
	return { cancelled: true, claimId: claim.id };
}

export interface AdminOverrideParams {
	newStatus: GuaranteeClaimStatus;
	adminUserId: string;
	reason: string;
}

export interface AdminOverrideResult {
	updated: boolean;
	previousStatus: GuaranteeClaimStatus;
	claim: GuaranteeClaim;
}

/**
 * Admin-driven status override. Writes an audit log entry then updates the
 * claim. Accepts any-to-any transitions (admin discretion).
 */
export async function adminOverrideStatus(
	db: DbClient,
	claimId: string,
	opts: AdminOverrideParams,
): Promise<AdminOverrideResult | null> {
	const claim = await guaranteeQueries.getClaimById(db, claimId);
	if (!claim) return null;

	const previousStatus = claim.status;
	const updated = await guaranteeQueries.updateClaim(db, claimId, {
		status: opts.newStatus,
		resolutionNotes: claim.resolutionNotes
			? `${claim.resolutionNotes}; admin (${opts.adminUserId}): ${opts.reason}`
			: `admin (${opts.adminUserId}): ${opts.reason}`,
	});

	// Audit log via auditQueries if available — fire-and-forget so admin
	// operations aren't blocked on audit storage hiccups.
	try {
		const { auditQueries } = await import("@beacon/db");
		const insertFn =
			(auditQueries as Record<string, unknown>).insertAuditLog ??
			(auditQueries as Record<string, unknown>).create ??
			(auditQueries as Record<string, unknown>).createAuditLog;
		if (typeof insertFn === "function") {
			await (insertFn as (db: DbClient, entry: unknown) => Promise<unknown>)(db, {
				userId: claim.userId,
				action: "guarantee_admin_override",
				details: {
					claimId,
					adminUserId: opts.adminUserId,
					previousStatus,
					newStatus: opts.newStatus,
					reason: opts.reason,
				},
			});
		}
	} catch {
		/* audit is best-effort */
	}

	return {
		updated: updated !== undefined,
		previousStatus,
		claim: updated ?? claim,
	};
}

/**
 * Guard used by the refund flow to reject cancelled / terminal claims.
 * Returns a machine-readable error code when not eligible, null when OK.
 */
export function refundEligibilityGuard(
	claim: GuaranteeClaim,
): { error: string; code: "CLAIM_TERMINAL" } | null {
	if (isTerminalStatus(claim.status) && claim.status !== "eligible_for_refund") {
		return {
			code: "CLAIM_TERMINAL",
			error: `claim_${claim.status}`,
		};
	}
	return null;
}
