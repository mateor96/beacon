import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

const { isGuaranteeEligible } = await import("../../guarantee/eligibility.js");

describe("isGuaranteeEligible", () => {
	it("returns true for pro/agency/enterprise plans", () => {
		expect(isGuaranteeEligible("pro")).toBe(true);
		expect(isGuaranteeEligible("agency")).toBe(true);
		expect(isGuaranteeEligible("enterprise")).toBe(true);
	});

	it("returns false for free/starter plans", () => {
		expect(isGuaranteeEligible("free")).toBe(false);
		expect(isGuaranteeEligible("starter")).toBe(false);
	});
});
