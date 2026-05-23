import { PLAN_NAMES, type PlanName } from "@beacon/shared";
import { describe, expect, it } from "vitest";
import {
	comparePlans,
	getDowngradeWarnings,
	getPlanIndex,
	getPlanTransition,
	getTransitionType,
	isDowngrade,
	isUpgrade,
} from "../transitions";

describe("getPlanIndex", () => {
	it("returns 0 for free", () => {
		expect(getPlanIndex("free")).toBe(0);
	});

	it("returns 1 for starter", () => {
		expect(getPlanIndex("starter")).toBe(1);
	});

	it("returns 2 for pro", () => {
		expect(getPlanIndex("pro")).toBe(2);
	});

	it("returns 3 for agency", () => {
		expect(getPlanIndex("agency")).toBe(3);
	});

	it("returns 4 for enterprise", () => {
		expect(getPlanIndex("enterprise")).toBe(4);
	});
});

describe("comparePlans", () => {
	it("returns negative when first plan is lower", () => {
		expect(comparePlans("free", "pro")).toBeLessThan(0);
	});

	it("returns positive when first plan is higher", () => {
		expect(comparePlans("enterprise", "free")).toBeGreaterThan(0);
	});

	it("returns 0 for same plan", () => {
		expect(comparePlans("pro", "pro")).toBe(0);
	});
});

describe("getTransitionType", () => {
	const cases: [PlanName, PlanName, "upgrade" | "downgrade" | "same"][] = [
		["free", "free", "same"],
		["free", "starter", "upgrade"],
		["free", "enterprise", "upgrade"],
		["starter", "free", "downgrade"],
		["pro", "starter", "downgrade"],
		["enterprise", "free", "downgrade"],
		["agency", "agency", "same"],
		["starter", "pro", "upgrade"],
		["agency", "enterprise", "upgrade"],
	];

	it.each(cases)("%s -> %s = %s", (from, to, expected) => {
		expect(getTransitionType(from, to)).toBe(expected);
	});

	it("handles all 25 plan combinations without throwing", () => {
		for (const from of PLAN_NAMES) {
			for (const to of PLAN_NAMES) {
				expect(() => getTransitionType(from, to)).not.toThrow();
			}
		}
	});
});

describe("isUpgrade", () => {
	it("returns true for free -> starter", () => {
		expect(isUpgrade("free", "starter")).toBe(true);
	});

	it("returns false for starter -> free", () => {
		expect(isUpgrade("starter", "free")).toBe(false);
	});

	it("returns false for same plan", () => {
		expect(isUpgrade("pro", "pro")).toBe(false);
	});
});

describe("isDowngrade", () => {
	it("returns true for pro -> starter", () => {
		expect(isDowngrade("pro", "starter")).toBe(true);
	});

	it("returns false for starter -> pro", () => {
		expect(isDowngrade("starter", "pro")).toBe(false);
	});

	it("returns false for same plan", () => {
		expect(isDowngrade("agency", "agency")).toBe(false);
	});
});

describe("getPlanTransition", () => {
	it("free -> pro requires checkout", () => {
		const t = getPlanTransition("free", "pro");
		expect(t.type).toBe("upgrade");
		expect(t.requiresCheckout).toBe(true);
		expect(t.requiresCancellation).toBe(false);
	});

	it("starter -> pro does not require checkout (already paying)", () => {
		const t = getPlanTransition("starter", "pro");
		expect(t.type).toBe("upgrade");
		expect(t.requiresCheckout).toBe(false);
	});

	it("pro -> free requires cancellation", () => {
		const t = getPlanTransition("pro", "free");
		expect(t.type).toBe("downgrade");
		expect(t.requiresCancellation).toBe(true);
	});

	it("pro -> starter does not require cancellation (still paying)", () => {
		const t = getPlanTransition("pro", "starter");
		expect(t.type).toBe("downgrade");
		expect(t.requiresCancellation).toBe(false);
	});

	it("any -> enterprise requires contact sales", () => {
		const t = getPlanTransition("pro", "enterprise");
		expect(t.requiresContactSales).toBe(true);
	});

	it("enterprise -> any requires contact sales", () => {
		const t = getPlanTransition("enterprise", "pro");
		expect(t.requiresContactSales).toBe(true);
	});

	it("same plan returns all false", () => {
		const t = getPlanTransition("pro", "pro");
		expect(t.type).toBe("same");
		expect(t.requiresCheckout).toBe(false);
		expect(t.requiresCancellation).toBe(false);
		expect(t.requiresContactSales).toBe(false);
	});

	it("enterprise -> enterprise requires contact sales", () => {
		const t = getPlanTransition("enterprise", "enterprise");
		expect(t.type).toBe("same");
		expect(t.requiresContactSales).toBe(true);
	});

	it("free -> starter requires checkout", () => {
		const t = getPlanTransition("free", "starter");
		expect(t.requiresCheckout).toBe(true);
	});

	it("free -> agency requires checkout", () => {
		const t = getPlanTransition("free", "agency");
		expect(t.requiresCheckout).toBe(true);
	});

	it("starter -> free requires cancellation", () => {
		const t = getPlanTransition("starter", "free");
		expect(t.requiresCancellation).toBe(true);
	});

	it("agency -> free requires cancellation", () => {
		const t = getPlanTransition("agency", "free");
		expect(t.requiresCancellation).toBe(true);
	});
});

describe("getDowngradeWarnings", () => {
	it("returns empty array for upgrades", () => {
		expect(getDowngradeWarnings("free", "pro")).toEqual([]);
	});

	it("returns empty array for same plan", () => {
		expect(getDowngradeWarnings("pro", "pro")).toEqual([]);
	});

	it("returns warnings for pro -> free (loses many features)", () => {
		const warnings = getDowngradeWarnings("pro", "free");
		expect(warnings.length).toBeGreaterThan(0);
		expect(warnings.some((w) => w.includes("Fix-Generierung"))).toBe(true);
		expect(warnings.some((w) => w.includes("KI-Analyse"))).toBe(true);
		expect(warnings.some((w) => w.includes("Scan-Limit"))).toBe(true);
	});

	it("returns warnings for agency -> starter (loses white-label, API, etc.)", () => {
		const warnings = getDowngradeWarnings("agency", "starter");
		expect(warnings.some((w) => w.includes("White-Label"))).toBe(true);
		expect(warnings.some((w) => w.includes("API-Zugang"))).toBe(true);
		expect(warnings.some((w) => w.includes("Benchmarking"))).toBe(true);
	});

	it("returns monitoring prompt limit warning for agency -> pro", () => {
		const warnings = getDowngradeWarnings("agency", "pro");
		expect(warnings.some((w) => w.includes("Monitoring-Prompts"))).toBe(true);
	});

	it("returns German-language warnings", () => {
		const warnings = getDowngradeWarnings("enterprise", "free");
		for (const w of warnings) {
			expect(w).toMatch(/[a-zA-ZäöüÄÖÜ]/);
		}
	});

	it("enterprise -> agency loses SSO, Priority Support, SLA", () => {
		const warnings = getDowngradeWarnings("enterprise", "agency");
		expect(warnings.some((w) => w.includes("SSO"))).toBe(true);
		expect(warnings.some((w) => w.includes("Priority Support"))).toBe(true);
		expect(warnings.some((w) => w.includes("SLA"))).toBe(true);
	});

	it("pro -> starter loses Fix-Deployment, KI-Analyse, Benachrichtigungen (but NOT Fix-Generierung)", () => {
		const warnings = getDowngradeWarnings("pro", "starter");
		expect(warnings.some((w) => w.includes("Fix-Generierung"))).toBe(false);
		expect(warnings.some((w) => w.includes("Fix-Deployment"))).toBe(true);
		expect(warnings.some((w) => w.includes("KI-Analyse"))).toBe(true);
		expect(warnings.some((w) => w.includes("Benachrichtigungen"))).toBe(true);
	});

	it("starter -> free loses Dashboard and PDF-Reports", () => {
		const warnings = getDowngradeWarnings("starter", "free");
		expect(warnings.some((w) => w.includes("Dashboard"))).toBe(true);
		expect(warnings.some((w) => w.includes("PDF-Reports"))).toBe(true);
	});
});
