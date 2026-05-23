import type { DbClient } from "@beacon/db";
import { auditQueries, guaranteeQueries } from "@beacon/db";
import type { PlanName } from "@beacon/shared";
import type Stripe from "stripe";
import { getPlanOrder } from "../plans.js";
import { PLAN_CONFIG } from "../plans.js";

/**
 * Rule identifiers. Persisted in audit logs and emitted in the
 * `reason` field of CheckGuaranteeEligibilityResult, so treat them as
 * stable API surface.
 */
export const GUARANTEE_RULE_IDS = [
	"plan_eligible",
	"first_signup",
	"no_downgrade",
	"no_resubscription",
	"dach_region",
] as const;
export type GuaranteeRuleId = (typeof GUARANTEE_RULE_IDS)[number];

const ENV_FLAG: Record<GuaranteeRuleId, string> = {
	plan_eligible: "GUARANTEE_RULE_PLAN_ELIGIBLE",
	first_signup: "GUARANTEE_RULE_FIRST_SIGNUP",
	no_downgrade: "GUARANTEE_RULE_NO_DOWNGRADE",
	no_resubscription: "GUARANTEE_RULE_NO_RESUBSCRIPTION",
	dach_region: "GUARANTEE_RULE_DACH_REGION",
};

const DACH_COUNTRIES = new Set(["DE", "AT", "CH"]);

/**
 * Rules default to ON. A deployment can disable a rule with
 * `<ENV_FLAG>=off`. Any other value (including unset) is treated as ON.
 */
export function isRuleEnabled(rule: GuaranteeRuleId): boolean {
	return process.env[ENV_FLAG[rule]] !== "off";
}

export interface RuleContext {
	tx: DbClient;
	userId: string;
	plan: PlanName;
	/** Plan the user was on *before* this event (if any). */
	previousPlan: PlanName | null;
	subscriptionId: string;
	stripeCustomerId: string | null;
	stripe?: Stripe;
}

export interface RuleResult {
	pass: boolean;
	reason?: string;
}

export function checkPlanEligible(ctx: RuleContext): RuleResult {
	if (!PLAN_CONFIG[ctx.plan].features.guaranteeEligible) {
		return { pass: false, reason: `Plan ${ctx.plan} is not guarantee-eligible` };
	}
	return { pass: true };
}

export async function checkFirstSignup(ctx: RuleContext): Promise<RuleResult> {
	const count = await guaranteeQueries.countClaimsForUser(ctx.tx, ctx.userId);
	if (count > 0) {
		return {
			pass: false,
			reason: `User already has ${count} prior guarantee claim(s); only first signup is eligible`,
		};
	}
	return { pass: true };
}

export function checkNoDowngrade(ctx: RuleContext): RuleResult {
	if (!ctx.previousPlan) return { pass: true };
	const prevOrder = getPlanOrder(ctx.previousPlan);
	const nextOrder = getPlanOrder(ctx.plan);
	if (nextOrder < prevOrder) {
		return {
			pass: false,
			reason: `Downgrade from ${ctx.previousPlan} to ${ctx.plan} is not eligible`,
		};
	}
	return { pass: true };
}

export async function checkNoResubscription(ctx: RuleContext): Promise<RuleResult> {
	// Any prior subscription_deleted event for this user flags a
	// re-subscription (canceled → signed up again).
	const prior = await auditQueries.getSubscriptionEventsByUserId(ctx.tx, ctx.userId, {
		limit: 50,
	});
	const hasCancellation = prior.some((e) => e.eventType === "customer.subscription.deleted");
	if (hasCancellation) {
		return {
			pass: false,
			reason: "User previously canceled a subscription; re-subscriptions are not eligible",
		};
	}
	return { pass: true };
}

export async function checkDachRegion(ctx: RuleContext): Promise<RuleResult> {
	if (!ctx.stripe || !ctx.stripeCustomerId) {
		// Without a Stripe client we cannot verify the billing address — fail
		// closed so mis-configured deployments don't over-grant guarantees.
		return {
			pass: false,
			reason: "Stripe customer address unavailable for DACH-region check",
		};
	}
	try {
		const customer = await ctx.stripe.customers.retrieve(ctx.stripeCustomerId);
		if (customer.deleted) {
			return { pass: false, reason: "Stripe customer is deleted" };
		}
		const country = customer.address?.country ?? customer.shipping?.address?.country ?? null;
		if (!country) {
			return { pass: false, reason: "No billing address country on Stripe customer" };
		}
		if (!DACH_COUNTRIES.has(country.toUpperCase())) {
			return { pass: false, reason: `Billing country ${country} is outside DACH (DE/AT/CH)` };
		}
		return { pass: true };
	} catch (err) {
		return {
			pass: false,
			reason: `Failed to fetch Stripe customer: ${err instanceof Error ? err.message : "unknown"}`,
		};
	}
}
