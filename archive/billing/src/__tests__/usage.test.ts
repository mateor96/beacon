import { describe, expect, it } from "vitest";
import {
	EMPTY_FIX_USAGE,
	EMPTY_MONITORING_USAGE,
	EMPTY_SCAN_USAGE,
	buildScanUsage,
	getUsageSummary,
} from "../usage";

describe("EMPTY constants", () => {
	it("EMPTY_SCAN_USAGE has zero values", () => {
		expect(EMPTY_SCAN_USAGE.monthlyScansUsed).toBe(0);
		expect(EMPTY_SCAN_USAGE.dailyScansUsed).toBe(0);
	});

	it("EMPTY_FIX_USAGE has zero fixes", () => {
		expect(EMPTY_FIX_USAGE.fixesThisMonth).toBe(0);
	});

	it("EMPTY_MONITORING_USAGE has zero prompts", () => {
		expect(EMPTY_MONITORING_USAGE.promptsThisMonth).toBe(0);
	});
});

describe("buildScanUsage", () => {
	it("maps profile fields to ScanUsage", () => {
		const usage = buildScanUsage({ monthlyScansUsed: 5, dailyScansUsed: 2 });
		expect(usage.monthlyScansUsed).toBe(5);
		expect(usage.dailyScansUsed).toBe(2);
	});

	it("works with zero values", () => {
		const usage = buildScanUsage({ monthlyScansUsed: 0, dailyScansUsed: 0 });
		expect(usage.monthlyScansUsed).toBe(0);
		expect(usage.dailyScansUsed).toBe(0);
	});
});

describe("getUsageSummary", () => {
	it("returns correct summary for free plan", () => {
		const summary = getUsageSummary(
			"free",
			{ monthlyScansUsed: 2, dailyScansUsed: 0 },
			{ fixesThisMonth: 0 },
			{ promptsThisMonth: 0 },
		);

		expect(summary.plan).toBe("free");
		expect(summary.scans.monthly.used).toBe(2);
		expect(summary.scans.monthly.limit).toBe(3);
		expect(summary.scans.monthly.remaining).toBe(1);
		expect(summary.scans.monthly.percentage).toBe(67);
	});

	it("returns 0% for unlimited limits", () => {
		const summary = getUsageSummary(
			"pro",
			{ monthlyScansUsed: 100, dailyScansUsed: 5 },
			{ fixesThisMonth: 10 },
			{ promptsThisMonth: 0 },
		);

		expect(summary.scans.monthly.limit).toBeNull();
		expect(summary.scans.monthly.remaining).toBeNull();
		expect(summary.scans.monthly.percentage).toBe(0);
	});

	it("returns 100% for disabled features (limit 0)", () => {
		const summary = getUsageSummary(
			"free",
			EMPTY_SCAN_USAGE,
			{ fixesThisMonth: 0 },
			{ promptsThisMonth: 0 },
		);

		expect(summary.fixes.limit).toBe(0);
		expect(summary.fixes.percentage).toBe(100);
	});

	it("caps percentage at 100 when over limit", () => {
		const summary = getUsageSummary(
			"free",
			{ monthlyScansUsed: 5, dailyScansUsed: 0 },
			EMPTY_FIX_USAGE,
			EMPTY_MONITORING_USAGE,
		);

		expect(summary.scans.monthly.percentage).toBe(100);
	});

	it("returns correct monitoring metrics for agency plan", () => {
		const summary = getUsageSummary("agency", EMPTY_SCAN_USAGE, EMPTY_FIX_USAGE, {
			promptsThisMonth: 50,
		});

		expect(summary.monitoring.used).toBe(50);
		expect(summary.monitoring.limit).toBe(100);
		expect(summary.monitoring.remaining).toBe(50);
		expect(summary.monitoring.percentage).toBe(50);
	});

	it("returns remaining=0 when exactly at limit (free plan 3/3 scans)", () => {
		const summary = getUsageSummary(
			"free",
			{ monthlyScansUsed: 3, dailyScansUsed: 0 },
			EMPTY_FIX_USAGE,
			EMPTY_MONITORING_USAGE,
		);
		expect(summary.scans.monthly.remaining).toBe(0);
		expect(summary.scans.monthly.percentage).toBe(100);
	});

	it("clamps remaining to 0 when over limit", () => {
		const summary = getUsageSummary(
			"free",
			{ monthlyScansUsed: 5, dailyScansUsed: 0 },
			EMPTY_FIX_USAGE,
			EMPTY_MONITORING_USAGE,
		);
		expect(summary.scans.monthly.remaining).toBe(0);
	});

	it("returns correct summary for starter plan", () => {
		const summary = getUsageSummary(
			"starter",
			{ monthlyScansUsed: 25, dailyScansUsed: 5 },
			{ fixesThisMonth: 0 },
			{ promptsThisMonth: 0 },
		);
		expect(summary.plan).toBe("starter");
		expect(summary.scans.monthly.limit).toBe(50);
		expect(summary.scans.monthly.remaining).toBe(25);
		expect(summary.scans.monthly.percentage).toBe(50);
		expect(summary.scans.daily.limit).toBe(10);
		expect(summary.scans.daily.remaining).toBe(5);
	});

	it("returns all unlimited for enterprise plan", () => {
		const summary = getUsageSummary(
			"enterprise",
			{ monthlyScansUsed: 500, dailyScansUsed: 100 },
			{ fixesThisMonth: 200 },
			{ promptsThisMonth: 1000 },
		);
		expect(summary.plan).toBe("enterprise");
		expect(summary.scans.monthly.limit).toBeNull();
		expect(summary.scans.monthly.remaining).toBeNull();
		expect(summary.scans.monthly.percentage).toBe(0);
		expect(summary.fixes.limit).toBeNull();
		expect(summary.monitoring.limit).toBeNull();
	});

	it("returns correct daily scan metrics", () => {
		const summary = getUsageSummary(
			"free",
			{ monthlyScansUsed: 0, dailyScansUsed: 1 },
			EMPTY_FIX_USAGE,
			EMPTY_MONITORING_USAGE,
		);
		expect(summary.scans.daily.used).toBe(1);
		expect(summary.scans.daily.limit).toBe(1);
		expect(summary.scans.daily.remaining).toBe(0);
		expect(summary.scans.daily.percentage).toBe(100);
	});
});
