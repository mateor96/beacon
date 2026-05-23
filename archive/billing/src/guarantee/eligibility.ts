import type { DbClient } from "@beacon/db";
import { auditQueries } from "@beacon/db";
import type { PlanName } from "@beacon/shared";
import type Stripe from "stripe";
import { PLAN_CONFIG } from "../plans.js";
import {
	type GuaranteeRuleId,
	checkDachRegion,
	checkFirstSignup,
	checkNoDowngrade,
	checkNoResubscription,
	checkPlanEligible,
	isRuleEnabled,
} from "./rules.js";

/**
 * Plans with the 90-day money-back guarantee feature flag set.
 * Single source of truth is PLAN_CONFIG[plan].features.guaranteeEligible;
 * this wrapper exists so callers don't need to import the whole plan config.
 */
export function isGuaranteeEligible(plan: PlanName): boolean {
	return PLAN_CONFIG[plan].features.guaranteeEligible;
}

export interface CheckGuaranteeEligibilityParams {
	tx: DbClient;
	userId: string;
	plan: PlanName;
	/** Plan the user had before this activation, for the no-downgrade rule. */
	previousPlan: PlanName | null;
	subscriptionId: string;
	stripeCustomerId: string | null;
	/** Injected so unit tests can stub Stripe without constructing a client. */
	stripe?: Stripe;
}

export interface CheckGuaranteeEligibilityResult {
	eligible: boolean;
	reason?: string;
	/** First rule that failed; null when all rules passed. */
	failedRule: GuaranteeRuleId | null;
}

/**
 * Run the five configurable guarantee-eligibility rules in sequence and
 * short-circuit on the first failure. Rejections are persisted to
 * auditLogs (`guarantee_eligibility_rejected`) so the admin dashboard can
 * surface them. All rules default to ON; individual rules can be disabled
 * with `GUARANTEE_RULE_<NAME>=off` to support staging/manual-override flows.
 */
export async function checkGuaranteeEligibility(
	params: CheckGuaranteeEligibilityParams,
): Promise<CheckGuaranteeEligibilityResult> {
	const ctx = {
		tx: params.tx,
		userId: params.userId,
		plan: params.plan,
		previousPlan: params.previousPlan,
		subscriptionId: params.subscriptionId,
		stripeCustomerId: params.stripeCustomerId,
		stripe: params.stripe,
	};

	const rules: Array<{
		id: GuaranteeRuleId;
		check: () => Promise<{ pass: boolean; reason?: string }> | { pass: boolean; reason?: string };
	}> = [
		{ id: "plan_eligible", check: () => checkPlanEligible(ctx) },
		{ id: "first_signup", check: () => checkFirstSignup(ctx) },
		{ id: "no_downgrade", check: () => checkNoDowngrade(ctx) },
		{ id: "no_resubscription", check: () => checkNoResubscription(ctx) },
		{ id: "dach_region", check: () => checkDachRegion(ctx) },
	];

	for (const rule of rules) {
		if (!isRuleEnabled(rule.id)) continue;
		const result = await rule.check();
		if (!result.pass) {
			await auditQueries
				.createAuditLog(params.tx, {
					userId: params.userId,
					action: "guarantee_eligibility_rejected",
					details: {
						ruleId: rule.id,
						reason: result.reason,
						plan: params.plan,
						previousPlan: params.previousPlan,
						subscriptionId: params.subscriptionId,
					},
				})
				.catch(() => {
					// Audit logging must never block activation flow.
				});
			return { eligible: false, reason: result.reason, failedRule: rule.id };
		}
	}

	return { eligible: true, failedRule: null };
}
