import { describe, expect, it } from "vitest";
import { PLAN_CONFIG } from "../../plans.js";
import { parseFeatureOverrides } from "../../stripe/metadata.js";

describe("parseFeatureOverrides (#477)", () => {
	it("returns null when metadata is missing", () => {
		expect(parseFeatureOverrides(null)).toBeNull();
		expect(parseFeatureOverrides(undefined)).toBeNull();
	});

	it("returns null when no `feature:` keys are present", () => {
		expect(parseFeatureOverrides({ other: "value" })).toBeNull();
	});

	it("parses a single feature override", () => {
		expect(parseFeatureOverrides({ "feature:webhooks": "true" })).toEqual({ webhooks: true });
	});

	it("parses 'false' as boolean false", () => {
		expect(parseFeatureOverrides({ "feature:sso": "false" })).toEqual({ sso: false });
	});

	it("ignores unknown feature keys", () => {
		expect(
			parseFeatureOverrides({
				"feature:nonsense": "true",
				"feature:webhooks": "true",
			}),
		).toEqual({ webhooks: true });
	});

	it("covers redditTracking (regression: #477)", () => {
		expect(parseFeatureOverrides({ "feature:redditTracking": "true" })).toEqual({
			redditTracking: true,
		});
	});

	it("covers fixDeployment (regression: #477)", () => {
		expect(parseFeatureOverrides({ "feature:fixDeployment": "true" })).toEqual({
			fixDeployment: true,
		});
	});

	it("VALID_FEATURES invariant: every PlanFeatures key is parseable", () => {
		const keys = Object.keys(PLAN_CONFIG.free.features);
		const parsed = parseFeatureOverrides(
			Object.fromEntries(keys.map((k) => [`feature:${k}`, "true"])),
		);
		for (const k of keys) {
			expect(parsed?.[k as keyof typeof parsed]).toBe(true);
		}
	});
});
