import type { PlanName } from "@beacon/shared";
import { FEATURE_LABELS, PLAN_CONFIG, findMinimumPlanFor } from "./plans.js";
import type { FeatureName, PlanFeatures, PlanLimits } from "./types.js";

// ── Feature Gate Info ───────────────────────────────────────

export interface FeatureGateInfo {
	hasAccess: boolean;
	currentPlan: PlanName;
	requiredPlan: PlanName;
	requiredPlanDisplayName: string;
	requiredPlanPrice: number;
	featureLabel: string;
}

export function getFeatureGateInfo(plan: PlanName, feature: FeatureName): FeatureGateInfo {
	const config = PLAN_CONFIG[plan];
	const hasAccess = config.features[feature];
	const requiredPlan = findMinimumPlanFor(feature);
	const requiredConfig = PLAN_CONFIG[requiredPlan];

	return {
		hasAccess,
		currentPlan: plan,
		requiredPlan,
		requiredPlanDisplayName: requiredConfig.displayName,
		requiredPlanPrice: requiredConfig.pricing.monthlyPriceCents,
		featureLabel: FEATURE_LABELS[feature],
	};
}

// ── Plan Data Accessors ─────────────────────────────────────

export function getPlanFeatures(plan: PlanName): PlanFeatures {
	return PLAN_CONFIG[plan].features;
}

export function getPlanLimits(plan: PlanName): PlanLimits {
	return PLAN_CONFIG[plan].limits;
}
