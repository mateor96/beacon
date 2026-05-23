import { beforeEach, describe, expect, it } from "vitest";

import { computeCommission, getCommissionRule } from "../../referral/commissions.js";

describe("computeCommission", () => {
	beforeEach(() => {
		for (const k of [
			"REFERRAL_RATE_FREE",
			"REFERRAL_RATE_STARTER",
			"REFERRAL_RATE_PRO",
			"REFERRAL_RATE_AGENCY",
			"REFERRAL_RATE_ENTERPRISE",
		]) {
			delete process.env[k];
		}
	});

	it("returns zero for non-positive invoice amount", () => {
		expect(computeCommission({ plan: "pro", netAmountCents: 0, tierConversionCount: 0 })).toEqual(
			expect.objectContaining({ amountCents: 0 }),
		);
		expect(
			computeCommission({ plan: "pro", netAmountCents: -100, tierConversionCount: 0 }),
		).toEqual(expect.objectContaining({ amountCents: 0 }));
	});

	it("applies default tier-0 rate (20%) for first conversions", () => {
		const res = computeCommission({ plan: "pro", netAmountCents: 10000, tierConversionCount: 5 });
		expect(res.amountCents).toBe(2000);
		expect(res.rateBps).toBe(2000);
	});

	it("escalates to tier-1 rate (25%) at 10 conversions", () => {
		const res = computeCommission({ plan: "pro", netAmountCents: 10000, tierConversionCount: 10 });
		expect(res.amountCents).toBe(2500);
		expect(res.rateBps).toBe(2500);
	});

	it("escalates to tier-2 rate (30%) at 50 conversions", () => {
		const res = computeCommission({ plan: "pro", netAmountCents: 10000, tierConversionCount: 75 });
		expect(res.amountCents).toBe(3000);
	});

	it("respects customRateBps override and clamps to [0, 10000]", () => {
		expect(
			computeCommission({
				plan: "pro",
				netAmountCents: 10000,
				tierConversionCount: 0,
				customRateBps: 3500,
			}).amountCents,
		).toBe(3500);
		expect(
			computeCommission({
				plan: "pro",
				netAmountCents: 10000,
				tierConversionCount: 0,
				customRateBps: 20000,
			}).rateBps,
		).toBe(10000);
		expect(
			computeCommission({
				plan: "pro",
				netAmountCents: 10000,
				tierConversionCount: 0,
				customRateBps: -50,
			}).rateBps,
		).toBe(0);
	});

	it("uses env override as a flat rate when set", () => {
		process.env.REFERRAL_RATE_PRO = "1500";
		const res = computeCommission({ plan: "pro", netAmountCents: 10000, tierConversionCount: 100 });
		expect(res.rateBps).toBe(1500);
		expect(res.amountCents).toBe(1500);
	});

	it("ignores invalid env override and falls back to defaults", () => {
		process.env.REFERRAL_RATE_PRO = "not-a-number";
		expect(getCommissionRule("pro").tiers.length).toBeGreaterThan(1);
	});

	it("rounds correctly for fractional cents", () => {
		// 1333 * 2000 / 10000 = 266.6 → 267
		expect(
			computeCommission({ plan: "pro", netAmountCents: 1333, tierConversionCount: 0 }).amountCents,
		).toBe(267);
	});

	// #303 additions — target 15+ commission-engine tests

	it("applies the same default tiers across all plans when no env override", () => {
		for (const plan of ["free", "starter", "pro", "agency", "enterprise"] as const) {
			const res = computeCommission({ plan, netAmountCents: 10000, tierConversionCount: 0 });
			expect(res.rateBps).toBe(2000);
			expect(res.amountCents).toBe(2000);
		}
	});

	it("tier lookup picks the highest-threshold tier the conversion count qualifies for", () => {
		// 9 conversions -> tier 0 (20%)
		expect(
			computeCommission({ plan: "pro", netAmountCents: 10000, tierConversionCount: 9 }).rateBps,
		).toBe(2000);
		// 49 conversions -> tier 1 (25%)
		expect(
			computeCommission({ plan: "pro", netAmountCents: 10000, tierConversionCount: 49 }).rateBps,
		).toBe(2500);
		// 51 conversions -> tier 2 (30%)
		expect(
			computeCommission({ plan: "pro", netAmountCents: 10000, tierConversionCount: 51 }).rateBps,
		).toBe(3000);
	});

	it("env override for a specific plan does not affect other plans", () => {
		process.env.REFERRAL_RATE_PRO = "1000"; // 10%
		expect(
			computeCommission({ plan: "pro", netAmountCents: 10000, tierConversionCount: 0 }).amountCents,
		).toBe(1000);
		// starter still uses defaults
		expect(
			computeCommission({ plan: "starter", netAmountCents: 10000, tierConversionCount: 0 })
				.amountCents,
		).toBe(2000);
	});

	it("customRateBps overrides tier lookup completely", () => {
		// Even with high tier conversion count, customRateBps wins
		const res = computeCommission({
			plan: "pro",
			netAmountCents: 10000,
			tierConversionCount: 100,
			customRateBps: 500, // 5%
		});
		expect(res.rateBps).toBe(500);
		expect(res.amountCents).toBe(500);
	});

	it("very small net amounts still produce integer cents", () => {
		const res = computeCommission({ plan: "pro", netAmountCents: 1, tierConversionCount: 0 });
		expect(Number.isInteger(res.amountCents)).toBe(true);
		expect(res.amountCents).toBeGreaterThanOrEqual(0);
	});

	it("getCommissionRule returns env-overridden single-tier when env is valid", () => {
		process.env.REFERRAL_RATE_AGENCY = "3300";
		const rule = getCommissionRule("agency");
		expect(rule.tiers).toEqual([{ minConversions: 0, rateBps: 3300 }]);
	});

	it("getCommissionRule type is 'recurring' by default", () => {
		const rule = getCommissionRule("pro");
		expect(rule.type).toBe("recurring");
		expect(rule.plan).toBe("pro");
	});
});
