import type { DbClient, NewAffiliate } from "@beacon/db";
import { referralQueries } from "@beacon/db";
import { generateUniqueReferralCode } from "./link-codes.js";
import { REFERRAL_TERMS_VERSION } from "./terms.js";

export interface EnrollAffiliateParams {
	userId: string;
	companyName?: string | null;
	payoutDetails: NewAffiliate["payoutDetails"];
	termsAccepted: boolean;
}

export type EnrollAffiliateResult =
	| { status: "created"; affiliateId: string }
	| { status: "already_enrolled"; affiliateId: string; currentStatus: string }
	| { status: "terms_required" };

/**
 * Create a pending affiliate application. Idempotent against the unique
 * index on (user_id): re-calling with the same userId returns the existing
 * record rather than creating a duplicate.
 */
export async function enrollAffiliate(
	tx: DbClient,
	params: EnrollAffiliateParams,
): Promise<EnrollAffiliateResult> {
	if (!params.termsAccepted) {
		return { status: "terms_required" };
	}

	const existing = await referralQueries.getAffiliateByUserId(tx, params.userId);
	if (existing) {
		return {
			status: "already_enrolled",
			affiliateId: existing.id,
			currentStatus: existing.status,
		};
	}

	const created = await referralQueries.createAffiliate(tx, {
		userId: params.userId,
		companyName: params.companyName ?? null,
		payoutDetails: params.payoutDetails,
		termsVersion: REFERRAL_TERMS_VERSION,
		termsAcceptedAt: new Date(),
		status: "pending",
	});
	return { status: "created", affiliateId: created.id };
}

export interface ApproveAffiliateResult {
	status: "approved" | "not_found" | "invalid_state";
	affiliateId?: string;
	firstLinkCode?: string;
}

/**
 * Admin action: approve a pending affiliate application, set status=active,
 * and auto-create the affiliate's first referral link.
 */
export async function approveAffiliate(tx: DbClient, id: string): Promise<ApproveAffiliateResult> {
	const affiliate = await referralQueries.getAffiliateById(tx, id);
	if (!affiliate) return { status: "not_found" };
	if (affiliate.status !== "pending") return { status: "invalid_state", affiliateId: id };

	const code = await generateUniqueReferralCode(tx);
	await referralQueries.createLink(tx, {
		affiliateId: affiliate.id,
		code,
		label: "default",
	});
	await referralQueries.updateAffiliate(tx, id, {
		status: "active",
		approvedAt: new Date(),
		rejectionReason: null,
	});
	return { status: "approved", affiliateId: id, firstLinkCode: code };
}

/**
 * Admin action: reject a pending application with a reason.
 */
export async function rejectAffiliate(
	tx: DbClient,
	id: string,
	reason: string,
): Promise<ApproveAffiliateResult> {
	const affiliate = await referralQueries.getAffiliateById(tx, id);
	if (!affiliate) return { status: "not_found" };
	if (affiliate.status !== "pending") return { status: "invalid_state", affiliateId: id };
	await referralQueries.updateAffiliate(tx, id, {
		status: "rejected",
		rejectionReason: reason.slice(0, 500),
	});
	return { status: "approved", affiliateId: id };
}
