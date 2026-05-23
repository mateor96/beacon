import { describe, expect, it } from "vitest";
import { resolveFeatures } from "../feature-resolver.js";
import { PLAN_CONFIG } from "../plans.js";

describe("resolveFeatures", () => {
	it("returns base config with no overrides", () => {
		const result = resolveFeatures("pro");
		expect(result).toEqual(PLAN_CONFIG.pro.features);
	});

	it("returns base config with null overrides", () => {
		const result = resolveFeatures("pro", null);
		expect(result).toEqual(PLAN_CONFIG.pro.features);
	});

	it("merges valid overrides", () => {
		const result = resolveFeatures("free", { dashboard: true });
		expect(result.dashboard).toBe(true);
		// Other features remain unchanged
		expect(result.fixGeneration).toBe(false);
	});

	it("ignores unknown keys in overrides", () => {
		const overrides = { unknownFeature: true } as unknown as Parameters<typeof resolveFeatures>[1];
		const result = resolveFeatures("free", overrides);
		expect(result).toEqual(PLAN_CONFIG.free.features);
	});

	it("ignores non-boolean values in overrides", () => {
		const overrides = { dashboard: "yes" } as unknown as Parameters<typeof resolveFeatures>[1];
		const result = resolveFeatures("free", overrides);
		expect(result.dashboard).toBe(false); // unchanged from base
	});

	it("does not mutate PLAN_CONFIG", () => {
		const before = { ...PLAN_CONFIG.free.features };
		resolveFeatures("free", { dashboard: true });
		expect(PLAN_CONFIG.free.features).toEqual(before);
	});
});
