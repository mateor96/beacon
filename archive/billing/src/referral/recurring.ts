import type { DbClient } from "@beacon/db";
import { referralQueries } from "@beacon/db";
import type { PlanName } from "@beacon/shared";
import { computeCommission } from "./commissions.js";

export interface RecordInvoiceCommissionParams {
	referredUserId: string;
	plan: PlanName;
	stripeInvoiceId: string;
	netAmountCents: number;
	currency?: string;
	periodStart?: Date | null;
	periodEnd?: Date | null;
}

export type RecordInvoiceCommissionResult =
	| { status: "no_conversion" }
	| { status: "conversion_not_paid" }
	| { status: "duplicate" }
	| {
			status: "recorded";
			commissionId: string;
			amountCents: number;
			rateBps: number;
	  };

/**
 * Record a commission row for an invoice paid by a referred user. Called
 * from the Stripe invoice.paid webhook branch. Idempotent via the partial
 * unique index on referral_commissions.stripe_invoice_id so retries are
 * safe.
 */
export async function recordInvoiceCommission(
	tx: DbClient,
	params: RecordInvoiceCommissionParams,
): Promise<RecordInvoiceCommissionResult> {
	const conversion = await referralQueries.getConversionByReferredUser(tx, params.referredUserId);
	if (!conversion) return { status: "no_conversion" };
	if (conversion.status !== "paid") return { status: "conversion_not_paid" };

	// Count previous commissions for tier lookup
	const existing = await referralQueries.listCommissionsForAffiliate(tx, conversion.affiliateId);
	const { amountCents, rateBps, type } = computeCommission({
		plan: params.plan,
		netAmountCents: params.netAmountCents,
		tierConversionCount: existing.length,
	});
	if (amountCents <= 0) return { status: "duplicate" };

	const commission = await referralQueries.createCommission(tx, {
		conversionId: conversion.id,
		affiliateId: conversion.affiliateId,
		amountCents,
		currency: params.currency ?? "EUR",
		type,
		stripeInvoiceId: params.stripeInvoiceId,
		periodStart: params.periodStart ?? null,
		periodEnd: params.periodEnd ?? null,
		status: "pending",
	});
	if (!commission) {
		// Invoice unique index rejected — we've already recorded this one.
		return { status: "duplicate" };
	}
	return { status: "recorded", commissionId: commission.id, amountCents, rateBps };
}
