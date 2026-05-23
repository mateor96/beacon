import type { CommissionType } from "@beacon/db";
import type { PlanName } from "@beacon/shared";

/**
 * Tier threshold → basis-points rate. Basis points: 2000 = 20%, 2500 = 25%.
 */
export interface CommissionTier {
	minConversions: number;
	rateBps: number;
}

export interface CommissionRule {
	plan: PlanName;
	type: CommissionType;
	tiers: CommissionTier[];
}

/**
 * Default commission rules. Tuned for DACH-typical 20 % first-tier, ramping
 * up for high-volume affiliates. Ops can override per plan via the env
 * variables below, e.g. `REFERRAL_RATE_PRO=2500` → flat 25 % for Pro.
 */
const DEFAULT_TIERS: CommissionTier[] = [
	{ minConversions: 0, rateBps: 2000 },
	{ minConversions: 10, rateBps: 2500 },
	{ minConversions: 50, rateBps: 3000 },
];

const ENV_KEY: Record<PlanName, string> = {
	free: "REFERRAL_RATE_FREE",
	starter: "REFERRAL_RATE_STARTER",
	pro: "REFERRAL_RATE_PRO",
	agency: "REFERRAL_RATE_AGENCY",
	enterprise: "REFERRAL_RATE_ENTERPRISE",
};

function envOverride(plan: PlanName): CommissionTier[] | null {
	const raw = process.env[ENV_KEY[plan]];
	if (!raw) return null;
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10000) return null;
	return [{ minConversions: 0, rateBps: parsed }];
}

export function getCommissionRule(plan: PlanName): CommissionRule {
	return {
		plan,
		type: "recurring",
		tiers: envOverride(plan) ?? DEFAULT_TIERS,
	};
}

export interface ComputeCommissionParams {
	plan: PlanName;
	/** Invoice net amount in cents (post-discount, pre-tax). */
	netAmountCents: number;
	/** How many prior conversions this affiliate already has (for tier). */
	tierConversionCount: number;
	/**
	 * Per-affiliate rate override in basis points (0–10000). Takes
	 * precedence over plan tiers when provided.
	 */
	customRateBps?: number | null;
}

export interface ComputeCommissionResult {
	amountCents: number;
	rateBps: number;
	type: CommissionType;
}

/**
 * Pure commission calculation. Looks up the tier by conversion count
 * (custom override wins), computes bps × net amount, rounds half-away-from-zero.
 */
export function computeCommission(params: ComputeCommissionParams): ComputeCommissionResult {
	if (params.netAmountCents <= 0) {
		return { amountCents: 0, rateBps: 0, type: "recurring" };
	}
	const rule = getCommissionRule(params.plan);
	let rateBps: number;
	if (typeof params.customRateBps === "number") {
		rateBps = Math.max(0, Math.min(10000, params.customRateBps));
	} else {
		const tier = [...rule.tiers]
			.sort((a, b) => b.minConversions - a.minConversions)
			.find((t) => params.tierConversionCount >= t.minConversions);
		rateBps = tier?.rateBps ?? rule.tiers[0]?.rateBps ?? 0;
	}
	const amountCents = Math.round((params.netAmountCents * rateBps) / 10000);
	return { amountCents, rateBps, type: rule.type };
}
