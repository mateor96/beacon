import { beforeEach, describe, expect, it } from "vitest";
import { checkCompetitiveAccess, getCompetitorScanFrequencyDays } from "../../competitive/guard.js";

describe("checkCompetitiveAccess", () => {
	beforeEach(() => {
		for (const p of ["FREE", "STARTER", "PRO", "AGENCY", "ENTERPRISE"]) {
			delete process.env[`COMPETITIVE_SCAN_FREQUENCY_${p}`];
		}
	});

	it("denies free plan for view", () => {
		expect(
			checkCompetitiveAccess({ plan: "free", competitorCount: 0, action: "view" }),
		).toMatchObject({ allowed: false, reason: "feature_not_available" });
	});

	it("allows pro plan for view", () => {
		expect(checkCompetitiveAccess({ plan: "pro", competitorCount: 0, action: "view" })).toEqual({
			allowed: true,
		});
	});

	it("denies create when at competitor limit", () => {
		const res = checkCompetitiveAccess({
			plan: "pro",
			competitorCount: 3,
			action: "create_competitor",
		});
		expect(res).toMatchObject({
			allowed: false,
			reason: "competitor_limit_reached",
			currentLimit: 3,
		});
	});

	it("allows create when below limit", () => {
		expect(
			checkCompetitiveAccess({
				plan: "pro",
				competitorCount: 2,
				action: "create_competitor",
			}),
		).toEqual({ allowed: true });
	});

	it("denies white label on plans without whiteLabel feature", () => {
		expect(
			checkCompetitiveAccess({ plan: "pro", competitorCount: 0, action: "use_white_label" }),
		).toMatchObject({ allowed: false, reason: "white_label_not_available" });
	});

	it("allows white label on agency plan", () => {
		expect(
			checkCompetitiveAccess({ plan: "agency", competitorCount: 0, action: "use_white_label" }),
		).toEqual({ allowed: true });
	});
});

describe("getCompetitorScanFrequencyDays", () => {
	beforeEach(() => {
		for (const p of ["FREE", "STARTER", "PRO", "AGENCY", "ENTERPRISE"]) {
			delete process.env[`COMPETITIVE_SCAN_FREQUENCY_${p}`];
		}
	});

	it("returns null for free", () => {
		expect(getCompetitorScanFrequencyDays("free")).toBeNull();
	});

	it("returns weekly for pro/agency, monthly for starter, daily for enterprise", () => {
		expect(getCompetitorScanFrequencyDays("starter")).toBe(30);
		expect(getCompetitorScanFrequencyDays("pro")).toBe(7);
		expect(getCompetitorScanFrequencyDays("agency")).toBe(7);
		expect(getCompetitorScanFrequencyDays("enterprise")).toBe(1);
	});

	it("respects env override", () => {
		process.env.COMPETITIVE_SCAN_FREQUENCY_PRO = "3";
		expect(getCompetitorScanFrequencyDays("pro")).toBe(3);
	});

	it("ignores invalid env override", () => {
		process.env.COMPETITIVE_SCAN_FREQUENCY_PRO = "nonsense";
		expect(getCompetitorScanFrequencyDays("pro")).toBe(7);
	});
});
