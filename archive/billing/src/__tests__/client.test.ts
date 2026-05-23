import { describe, expect, it } from "vitest";
import { getFeatureGateInfo, getPlanFeatures, getPlanLimits } from "../client.js";
import { PLAN_CONFIG } from "../plans.js";

describe("getFeatureGateInfo", () => {
	it("returns hasAccess=true for pro + fixGeneration", () => {
		const info = getFeatureGateInfo("pro", "fixGeneration");
		expect(info.hasAccess).toBe(true);
		expect(info.currentPlan).toBe("pro");
	});

	it("returns hasAccess=false for free + fixGeneration", () => {
		const info = getFeatureGateInfo("free", "fixGeneration");
		expect(info.hasAccess).toBe(false);
		expect(info.requiredPlan).toBe("starter");
		expect(info.requiredPlanDisplayName).toBe("Starter");
	});

	it("returns correct German feature label", () => {
		const info = getFeatureGateInfo("free", "fixGeneration");
		expect(info.featureLabel).toBe("Fix-Generierung");
	});

	it("returns correct price in cents", () => {
		const info = getFeatureGateInfo("free", "fixGeneration");
		expect(info.requiredPlanPrice).toBe(PLAN_CONFIG.starter.pricing.monthlyPriceCents);
	});
});

describe("getPlanFeatures", () => {
	it("returns features for the given plan", () => {
		expect(getPlanFeatures("free")).toEqual(PLAN_CONFIG.free.features);
	});
});

describe("getPlanLimits", () => {
	it("returns limits for the given plan", () => {
		expect(getPlanLimits("free")).toEqual(PLAN_CONFIG.free.limits);
	});
});
