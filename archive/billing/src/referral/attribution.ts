import type { DbClient } from "@beacon/db";
import { referralQueries } from "@beacon/db";

export interface AttributeSignupParams {
	tx: DbClient;
	newUserId: string;
	/** awr_ref cookie value set by /r/[code] redirect. */
	cookieCode?: string | null;
	/** UTM campaign (?utm_campaign=code) fallback when cookie missing. */
	utmCampaign?: string | null;
}

export type AttributeSignupResult =
	| { status: "attributed"; conversionId: string; affiliateId: string }
	| { status: "duplicate"; conversionId: string }
	| { status: "no_attribution"; reason: string };

/**
 * Resolve the referral code → link → affiliate and create a `signup`
 * conversion row. Guards:
 *  - No code provided → no_attribution
 *  - Code not found or link inactive → no_attribution
 *  - Affiliate self-referring themselves → no_attribution
 *  - User already has a conversion row → duplicate (unique index)
 *
 * Last-click wins naturally: the cookie is overwritten on each fresh
 * redirect, so whichever code is live at signup time is the attributed one.
 */
export async function attributeSignup(
	params: AttributeSignupParams,
): Promise<AttributeSignupResult> {
	const code = params.cookieCode?.trim() || params.utmCampaign?.trim();
	if (!code) return { status: "no_attribution", reason: "no_code" };

	const link = await referralQueries.getLinkByCode(params.tx, code);
	if (!link || link.isActive !== 1) {
		return { status: "no_attribution", reason: "link_inactive" };
	}

	const affiliate = await referralQueries.getAffiliateById(params.tx, link.affiliateId);
	if (!affiliate || affiliate.status !== "active") {
		return { status: "no_attribution", reason: "affiliate_inactive" };
	}
	if (affiliate.userId === params.newUserId) {
		return { status: "no_attribution", reason: "self_referral" };
	}

	const method = params.cookieCode ? "cookie" : "utm";
	const created = await referralQueries.createConversion(params.tx, {
		referralLinkId: link.id,
		affiliateId: affiliate.id,
		referredUserId: params.newUserId,
		attributionMethod: method,
		status: "signup",
	});
	if (!created) {
		// Unique index on referred_user_id rejected this; existing conversion wins.
		const existing = await referralQueries.getConversionByReferredUser(params.tx, params.newUserId);
		return { status: "duplicate", conversionId: existing?.id ?? "unknown" };
	}
	return { status: "attributed", conversionId: created.id, affiliateId: affiliate.id };
}

/**
 * Transition a conversion from signup/trial → paid on first successful
 * invoice. Idempotent: only updates if status is not already paid/churned
 * and firstPaymentAt is null.
 */
export async function markConversionPaid(
	tx: DbClient,
	referredUserId: string,
	firstPaymentAt: Date,
): Promise<{ updated: boolean; conversionId?: string }> {
	const conversion = await referralQueries.getConversionByReferredUser(tx, referredUserId);
	if (!conversion) return { updated: false };
	if (conversion.status === "paid" || conversion.status === "churned") {
		return { updated: false, conversionId: conversion.id };
	}
	await referralQueries.updateConversion(tx, conversion.id, {
		status: "paid",
		firstPaymentAt: conversion.firstPaymentAt ?? firstPaymentAt,
	});
	return { updated: true, conversionId: conversion.id };
}
