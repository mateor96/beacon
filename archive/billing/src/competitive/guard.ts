import type { PlanName } from "@beacon/shared";
import { PLAN_CONFIG, findMinimumPlanFor } from "../plans.js";

/**
 * Competitor scan frequency per plan, in days. null = not allowed.
 * Configurable via env GUARANTEE-style overrides if ops needs to tune
 * without a deploy.
 */
const DEFAULT_SCAN_FREQUENCY_DAYS: Record<PlanName, number | null> = {
	free: null,
	starter: 30,
	pro: 7,
	agency: 7,
	enterprise: 1,
};

export function getCompetitorScanFrequencyDays(plan: PlanName): number | null {
	const override = process.env[`COMPETITIVE_SCAN_FREQUENCY_${plan.toUpperCase()}`];
	if (override) {
		const parsed = Number.parseInt(override, 10);
		if (Number.isFinite(parsed) && parsed > 0) return parsed;
	}
	return DEFAULT_SCAN_FREQUENCY_DAYS[plan];
}

export interface CompetitiveAccessCheck {
	plan: PlanName;
	competitorCount: number;
	action: "view" | "create_competitor" | "trigger_scan" | "use_white_label";
}

export type CompetitiveAccessResult =
	| { allowed: true; upgradeTo?: undefined; reason?: undefined }
	| {
			allowed: false;
			reason: "feature_not_available" | "competitor_limit_reached" | "white_label_not_available";
			upgradeTo: PlanName | null;
			currentLimit?: number;
	  };

/**
 * Unified competitive access guard — use in route handlers and UI gates.
 *  - view / trigger_scan: requires competitiveIntel feature flag
 *  - create_competitor: additionally checks competitorBenchmarks limit
 *  - use_white_label: requires whiteLabel feature flag
 */
export function checkCompetitiveAccess(params: CompetitiveAccessCheck): CompetitiveAccessResult {
	const cfg = PLAN_CONFIG[params.plan];

	if (params.action === "use_white_label") {
		if (!cfg.features.whiteLabel) {
			return {
				allowed: false,
				reason: "white_label_not_available",
				upgradeTo: findMinimumPlanFor("whiteLabel"),
			};
		}
		return { allowed: true };
	}

	if (!cfg.features.competitiveIntel) {
		return {
			allowed: false,
			reason: "feature_not_available",
			upgradeTo: findMinimumPlanFor("competitiveIntel"),
		};
	}

	if (params.action === "create_competitor") {
		const limit = cfg.limits.competitorBenchmarks;
		if (limit !== null && params.competitorCount >= limit) {
			return {
				allowed: false,
				reason: "competitor_limit_reached",
				upgradeTo: null,
				currentLimit: limit,
			};
		}
	}

	return { allowed: true };
}
