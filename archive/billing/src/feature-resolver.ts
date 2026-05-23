import type { PlanName } from "@beacon/shared";
import { PLAN_CONFIG } from "./plans.js";
import type { PlanFeatures } from "./types.js";

/**
 * Merge base plan features with optional per-customer overrides.
 * Overrides come from profiles.featureOverrides (set by Stripe webhook).
 * Unknown keys in overrides are silently ignored (fail-safe).
 */
export function resolveFeatures(
	plan: PlanName,
	overrides?: Partial<PlanFeatures> | null,
): PlanFeatures {
	const base = { ...PLAN_CONFIG[plan].features };
	if (!overrides) return base;

	for (const key of Object.keys(base) as (keyof PlanFeatures)[]) {
		const value = overrides[key];
		if (typeof value === "boolean") {
			base[key] = value;
		}
	}

	return base;
}
