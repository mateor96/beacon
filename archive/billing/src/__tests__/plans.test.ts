import { PLAN_NAMES, PLAN_RETENTION_DAYS } from "@beacon/shared";
import { describe, expect, it } from "vitest";
import {
	PLAN_CONFIG,
	findMinimumPlanFor,
	findMinimumPlanForLimit,
	getPlanConfig,
	getPlanOrder,
	isWithinLimit,
} from "../plans";
import type { PlanFeatures, PlanLimits } from "../types";

describe("PLAN_CONFIG", () => {
	it("has an entry for every PlanName", () => {
		for (const plan of PLAN_NAMES) {
			expect(PLAN_CONFIG[plan]).toBeDefined();
			expect(PLAN_CONFIG[plan].name).toBe(plan);
		}
	});

	it("has exactly 5 entries", () => {
		expect(Object.keys(PLAN_CONFIG)).toHaveLength(5);
	});

	it("orders are sequential 0-4", () => {
		const orders = PLAN_NAMES.map((p) => PLAN_CONFIG[p].order);
		expect(orders).toEqual([0, 1, 2, 3, 4]);
	});

	it("matches the exact config snapshot", () => {
		expect(PLAN_CONFIG).toMatchSnapshot();
	});

	it("PlanFeatures has exactly 25 keys", () => {
		expect(Object.keys(PLAN_CONFIG.free.features)).toHaveLength(25);
	});

	it("PlanLimits has exactly 17 keys", () => {
		expect(Object.keys(PLAN_CONFIG.free.limits)).toHaveLength(17);
	});

	it("exports all original 12 feature keys", () => {
		const original = [
			"dashboard",
			"pdfReports",
			"fixGeneration",
			"aiAnalysis",
			"alerts",
			"whiteLabel",
			"batchScan",
			"apiAccess",
			"benchmarking",
			"sso",
			"prioritySupport",
			"sla",
		];
		for (const key of original) {
			expect(key in PLAN_CONFIG.free.features).toBe(true);
		}
	});
});

describe("feature superset invariant", () => {
	it("every feature enabled in a lower tier is also enabled in all higher tiers", () => {
		for (let i = 0; i < PLAN_NAMES.length - 1; i++) {
			const lower = PLAN_CONFIG[PLAN_NAMES[i]];
			const higher = PLAN_CONFIG[PLAN_NAMES[i + 1]];

			for (const [key, value] of Object.entries(lower.features)) {
				if (value === true) {
					expect(
						higher.features[key as keyof PlanFeatures],
						`${higher.name}.features.${key} should be true since ${lower.name} has it`,
					).toBe(true);
				}
			}
		}
	});

	it("every numeric limit in a higher tier is >= the lower tier (or unlimited)", () => {
		const numericKeys = Object.keys(PLAN_CONFIG.free.limits).filter(
			(k) => k !== "retentionDays",
		) as (keyof PlanLimits)[];

		for (let i = 0; i < PLAN_NAMES.length - 1; i++) {
			const lower = PLAN_CONFIG[PLAN_NAMES[i]];
			const higher = PLAN_CONFIG[PLAN_NAMES[i + 1]];

			for (const key of numericKeys) {
				const lVal = lower.limits[key];
				const hVal = higher.limits[key];

				// null = unlimited, always >= any value
				if (hVal === null) continue;
				if (lVal === null) {
					throw new Error(
						`${lower.name}.limits.${key} is unlimited but ${higher.name}.limits.${key} is ${hVal}`,
					);
				}

				expect(
					hVal,
					`${higher.name}.limits.${key} (${hVal}) should be >= ${lower.name}.limits.${key} (${lVal})`,
				).toBeGreaterThanOrEqual(lVal as number);
			}
		}
	});

	it("retentionDays increases with each tier", () => {
		for (let i = 0; i < PLAN_NAMES.length - 1; i++) {
			const lower = PLAN_CONFIG[PLAN_NAMES[i]].limits.retentionDays;
			const higher = PLAN_CONFIG[PLAN_NAMES[i + 1]].limits.retentionDays;
			expect(higher).toBeGreaterThanOrEqual(lower);
		}
	});
});

describe("retentionDays sync with @beacon/shared", () => {
	it("matches PLAN_RETENTION_DAYS for all plans", () => {
		for (const plan of PLAN_NAMES) {
			expect(PLAN_CONFIG[plan].limits.retentionDays).toBe(PLAN_RETENTION_DAYS[plan]);
		}
	});
});

describe("specific plan values", () => {
	it("Free plan has 3 scans/month and no features", () => {
		const free = PLAN_CONFIG.free;
		expect(free.limits.scansPerMonth).toBe(3);
		expect(free.limits.scansPerDay).toBe(1);
		expect(free.pricing.monthlyPriceCents).toBe(0);
		expect(Object.values(free.features).every((v) => v === false)).toBe(true);
	});

	it("Starter plan has dashboard and PDF reports", () => {
		const starter = PLAN_CONFIG.starter;
		expect(starter.limits.scansPerMonth).toBe(50);
		expect(starter.features.dashboard).toBe(true);
		expect(starter.features.pdfReports).toBe(true);
		expect(starter.features.fixGeneration).toBe(true);
	});

	it("Pro plan has unlimited scans and fix generation", () => {
		const pro = PLAN_CONFIG.pro;
		expect(pro.limits.scansPerMonth).toBeNull();
		expect(pro.limits.monitoringPrompts).toBe(25);
		expect(pro.features.fixGeneration).toBe(true);
		expect(pro.features.aiAnalysis).toBe(true);
		expect(pro.features.whiteLabel).toBe(false);
	});

	it("Agency plan has white-label and API access", () => {
		const agency = PLAN_CONFIG.agency;
		expect(agency.limits.monitoringPrompts).toBe(100);
		expect(agency.features.whiteLabel).toBe(true);
		expect(agency.features.apiAccess).toBe(true);
		expect(agency.features.benchmarking).toBe(true);
		expect(agency.features.sso).toBe(false);
	});

	it("Enterprise plan has all features enabled", () => {
		const ent = PLAN_CONFIG.enterprise;
		expect(Object.values(ent.features).every((v) => v === true)).toBe(true);
		expect(ent.limits.scansPerMonth).toBeNull();
		expect(ent.limits.monitoringPrompts).toBeNull();
	});
});

describe("getPlanConfig", () => {
	it("returns correct config for each plan", () => {
		for (const plan of PLAN_NAMES) {
			expect(getPlanConfig(plan).name).toBe(plan);
		}
	});
});

describe("getPlanOrder", () => {
	it("returns sequential order values", () => {
		expect(getPlanOrder("free")).toBe(0);
		expect(getPlanOrder("starter")).toBe(1);
		expect(getPlanOrder("pro")).toBe(2);
		expect(getPlanOrder("agency")).toBe(3);
		expect(getPlanOrder("enterprise")).toBe(4);
	});
});

describe("isWithinLimit", () => {
	it("returns true when under limit", () => {
		expect(isWithinLimit(2, 3)).toBe(true);
	});

	it("returns false when at limit", () => {
		expect(isWithinLimit(3, 3)).toBe(false);
	});

	it("returns false when over limit", () => {
		expect(isWithinLimit(4, 3)).toBe(false);
	});

	it("returns true for any value when limit is null (unlimited)", () => {
		expect(isWithinLimit(999999, null)).toBe(true);
	});

	it("returns true for 0 used and 0 limit is false", () => {
		expect(isWithinLimit(0, 0)).toBe(false);
	});
});

describe("findMinimumPlanFor", () => {
	it("returns starter for dashboard", () => {
		expect(findMinimumPlanFor("dashboard")).toBe("starter");
	});

	it("returns starter for fixGeneration", () => {
		expect(findMinimumPlanFor("fixGeneration")).toBe("starter");
	});

	it("returns agency for whiteLabel", () => {
		expect(findMinimumPlanFor("whiteLabel")).toBe("agency");
	});

	it("returns enterprise for sso", () => {
		expect(findMinimumPlanFor("sso")).toBe("enterprise");
	});

	it("returns starter for pdfReports", () => {
		expect(findMinimumPlanFor("pdfReports")).toBe("starter");
	});

	it("returns pro for aiAnalysis", () => {
		expect(findMinimumPlanFor("aiAnalysis")).toBe("pro");
	});

	it("returns pro for alerts", () => {
		expect(findMinimumPlanFor("alerts")).toBe("pro");
	});

	it("returns agency for batchScan", () => {
		expect(findMinimumPlanFor("batchScan")).toBe("agency");
	});

	it("returns agency for apiAccess", () => {
		expect(findMinimumPlanFor("apiAccess")).toBe("agency");
	});

	it("returns agency for benchmarking", () => {
		expect(findMinimumPlanFor("benchmarking")).toBe("agency");
	});

	it("returns enterprise for prioritySupport", () => {
		expect(findMinimumPlanFor("prioritySupport")).toBe("enterprise");
	});

	it("returns enterprise for sla", () => {
		expect(findMinimumPlanFor("sla")).toBe("enterprise");
	});

	it.each([
		["csvExport", "starter"],
		["scoreSnapshots", "starter"],
		["aiVisibilityMonitoring", "pro"],
		["llmCitationTracking", "pro"],
		["competitiveIntel", "pro"],
		["guaranteeEligible", "pro"],
		["multiLanguage", "agency"],
		["redditTracking", "agency"],
		["webhooks", "agency"],
		["lookerStudio", "agency"],
		["affiliateProgram", "agency"],
		["customReportBranding", "enterprise"],
	] as const)("findMinimumPlanFor('%s') returns '%s'", (feature, expected) => {
		expect(findMinimumPlanFor(feature)).toBe(expected);
	});
});

describe("findMinimumPlanForLimit", () => {
	it("returns free for needing 1 scan/month", () => {
		expect(findMinimumPlanForLimit("scansPerMonth", 1)).toBe("free");
	});

	it("returns starter for needing 10 scans/month", () => {
		expect(findMinimumPlanForLimit("scansPerMonth", 10)).toBe("starter");
	});

	it("returns pro for needing unlimited scans (51+)", () => {
		expect(findMinimumPlanForLimit("scansPerMonth", 51)).toBe("pro");
	});

	it("returns free for needing 1 scan/day", () => {
		expect(findMinimumPlanForLimit("scansPerDay", 1)).toBe("free");
	});

	it("returns starter for needing 5 scans/day", () => {
		expect(findMinimumPlanForLimit("scansPerDay", 5)).toBe("starter");
	});

	it("returns pro for needing 11+ scans/day (unlimited)", () => {
		expect(findMinimumPlanForLimit("scansPerDay", 11)).toBe("pro");
	});

	it("returns pro for needing 1 monitoring prompt", () => {
		expect(findMinimumPlanForLimit("monitoringPrompts", 1)).toBe("pro");
	});

	it("returns agency for needing 26 monitoring prompts", () => {
		expect(findMinimumPlanForLimit("monitoringPrompts", 26)).toBe("agency");
	});

	it("returns enterprise for needing 101 monitoring prompts", () => {
		expect(findMinimumPlanForLimit("monitoringPrompts", 101)).toBe("enterprise");
	});

	it("returns agency for needing 1 API call", () => {
		expect(findMinimumPlanForLimit("apiCallsPerMonth", 1)).toBe("agency");
	});

	it("returns enterprise for needing 10001 API calls", () => {
		expect(findMinimumPlanForLimit("apiCallsPerMonth", 10001)).toBe("enterprise");
	});

	it("returns agency for needing 5 team members", () => {
		expect(findMinimumPlanForLimit("teamMembers", 5)).toBe("agency");
	});

	it("returns enterprise for needing 6 team members", () => {
		expect(findMinimumPlanForLimit("teamMembers", 6)).toBe("enterprise");
	});

	it("returns null when retentionDays exceeds all plans (731)", () => {
		expect(findMinimumPlanForLimit("retentionDays", 731)).toBeNull();
	});

	it("returns enterprise for retentionDays = 730 (exact boundary)", () => {
		expect(findMinimumPlanForLimit("retentionDays", 730)).toBe("enterprise");
	});
});
