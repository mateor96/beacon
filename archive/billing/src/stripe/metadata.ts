import { PLAN_CONFIG } from "../plans.js";
import type { PlanFeatures } from "../types.js";

/**
 * Derived from `PLAN_CONFIG.free.features` so new feature flags added to
 * `PlanFeatures` are automatically parseable from Stripe metadata —
 * eliminates the drift bug where hand-maintained lists missed newly-added
 * features (e.g. redditTracking, fixDeployment).
 */
const VALID_FEATURES: Set<keyof PlanFeatures> = new Set(
	Object.keys(PLAN_CONFIG.free.features) as (keyof PlanFeatures)[],
);

/**
 * Parse feature overrides from Stripe subscription metadata.
 * Convention: keys prefixed with "feature:" map to PlanFeatures keys.
 * e.g., "feature:webhooks" = "true" -> { webhooks: true }
 * Unknown keys are silently ignored.
 */
export function parseFeatureOverrides(
	metadata: Record<string, string> | null | undefined,
): Partial<PlanFeatures> | null {
	if (!metadata) return null;

	const overrides: Partial<PlanFeatures> = {};
	let hasAny = false;

	for (const [key, value] of Object.entries(metadata)) {
		if (!key.startsWith("feature:")) continue;
		const featureKey = key.slice(8) as keyof PlanFeatures;
		if (VALID_FEATURES.has(featureKey)) {
			(overrides as Record<string, boolean>)[featureKey] = value === "true";
			hasAny = true;
		}
	}

	return hasAny ? overrides : null;
}
