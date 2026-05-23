import { PLAN_NAMES, type PlanName } from "@beacon/shared";
import { describe, expect, it } from "vitest";
import {
	canAccessDashboard,
	canDeploy,
	canExportPdf,
	canFix,
	canScan,
	canUseAffiliateProgram,
	canUseAiAnalysis,
	canUseAiVisibilityMonitoring,
	canUseAlerts,
	canUseApi,
	canUseBatchScan,
	canUseBenchmarking,
	canUseCompetitiveIntel,
	canUseCsvExport,
	canUseCustomReportBranding,
	canUseGuarantee,
	canUseLlmCitationTracking,
	canUseLookerStudio,
	canUseMonitoring,
	canUseMultiLanguage,
	canUseScoreSnapshots,
	canUseSso,
	canUseWebhooks,
	canUseWhiteLabel,
	checkApiCallQuota,
	checkCompetitorQuota,
	checkDeploymentQuota,
	checkFeatureAccess,
	checkFixQuota,
	checkMonitoringProjectQuota,
	checkMonitoringQuota,
	checkScanQuota,
	checkWebhookEndpointQuota,
	isSubscriptionActive,
} from "../guards";

// ── checkScanQuota ──────────────────────────────────────────

describe("checkScanQuota", () => {
	it("allows free plan with 0 scans used", () => {
		const result = checkScanQuota("free", { monthlyScansUsed: 0, dailyScansUsed: 0 });
		expect(result.allowed).toBe(true);
	});

	it("allows free plan with 2 scans used (under limit of 3)", () => {
		const result = checkScanQuota("free", { monthlyScansUsed: 2, dailyScansUsed: 0 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(1);
	});

	it("denies free plan at monthly limit (3/3)", () => {
		const result = checkScanQuota("free", { monthlyScansUsed: 3, dailyScansUsed: 0 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("Monatliches Scan-Limit");
		expect(result.current).toBe(3);
		expect(result.limit).toBe(3);
	});

	it("denies free plan at daily limit (1/1)", () => {
		const result = checkScanQuota("free", { monthlyScansUsed: 0, dailyScansUsed: 1 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("Tägliches Scan-Limit");
	});

	it("monthly limit checked before daily limit", () => {
		const result = checkScanQuota("free", { monthlyScansUsed: 3, dailyScansUsed: 1 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("Monatliches");
	});

	it("allows pro plan with unlimited scans", () => {
		const result = checkScanQuota("pro", { monthlyScansUsed: 999999, dailyScansUsed: 0 });
		expect(result.allowed).toBe(true);
		expect(result.limit).toBeNull();
		expect(result.remaining).toBeNull();
	});

	it("allows enterprise plan with any usage", () => {
		const result = checkScanQuota("enterprise", {
			monthlyScansUsed: 999999,
			dailyScansUsed: 999999,
		});
		expect(result.allowed).toBe(true);
	});

	it("denies starter at monthly limit (50/50)", () => {
		const result = checkScanQuota("starter", { monthlyScansUsed: 50, dailyScansUsed: 0 });
		expect(result.allowed).toBe(false);
		expect(result.upgradeTo).toBe("pro");
	});

	it("denies starter at daily limit (10/10)", () => {
		const result = checkScanQuota("starter", { monthlyScansUsed: 0, dailyScansUsed: 10 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("Tägliches");
	});

	it("allows agency plan with unlimited scans", () => {
		const result = checkScanQuota("agency", { monthlyScansUsed: 999999, dailyScansUsed: 999999 });
		expect(result.allowed).toBe(true);
		expect(result.limit).toBeNull();
		expect(result.remaining).toBeNull();
	});

	it("returns remaining=0 when over monthly limit", () => {
		const result = checkScanQuota("free", { monthlyScansUsed: 5, dailyScansUsed: 0 });
		expect(result.allowed).toBe(false);
		expect(result.remaining).toBe(0);
	});

	it("returns upgradeTo=starter for free plan monthly denial", () => {
		const result = checkScanQuota("free", { monthlyScansUsed: 3, dailyScansUsed: 0 });
		expect(result.upgradeTo).toBe("starter");
	});

	it("returns upgradeTo=null for daily limit denial", () => {
		const result = checkScanQuota("starter", { monthlyScansUsed: 0, dailyScansUsed: 10 });
		expect(result.upgradeTo).toBeNull();
	});
});

// ── checkFixQuota ───────────────────────────────────────────

describe("checkFixQuota", () => {
	it("denies free plan (feature not available)", () => {
		const result = checkFixQuota("free", { fixesThisMonth: 0 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("nicht verfügbar");
		expect(result.upgradeTo).toBe("starter");
	});

	it("allows starter plan with fixes available", () => {
		const result = checkFixQuota("starter", { fixesThisMonth: 0 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(10);
	});

	it("allows pro plan with fixes available", () => {
		const result = checkFixQuota("pro", { fixesThisMonth: 0 });
		expect(result.allowed).toBe(true);
	});

	it("allows pro plan with unlimited fixes", () => {
		const result = checkFixQuota("pro", { fixesThisMonth: 999999 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBeNull();
	});

	it("allows enterprise plan", () => {
		const result = checkFixQuota("enterprise", { fixesThisMonth: 999999 });
		expect(result.allowed).toBe(true);
	});

	it("allows agency plan with unlimited fixes", () => {
		const result = checkFixQuota("agency", { fixesThisMonth: 999999 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBeNull();
	});

	it("denies starter plan at fix limit (10/10)", () => {
		const result = checkFixQuota("starter", { fixesThisMonth: 10 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("Fix-Limit");
		expect(result.upgradeTo).toBe("pro");
	});
});

// ── checkMonitoringQuota ────────────────────────────────────

describe("checkMonitoringQuota", () => {
	it("denies free plan", () => {
		const result = checkMonitoringQuota("free", { promptsThisMonth: 0 });
		expect(result.allowed).toBe(false);
	});

	it("allows pro plan with 24 prompts (under limit of 25)", () => {
		const result = checkMonitoringQuota("pro", { promptsThisMonth: 24 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(1);
	});

	it("denies pro plan at monitoring limit (25/25)", () => {
		const result = checkMonitoringQuota("pro", { promptsThisMonth: 25 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("Monitoring-Prompt-Limit");
	});

	it("allows agency plan with 99 prompts", () => {
		const result = checkMonitoringQuota("agency", { promptsThisMonth: 99 });
		expect(result.allowed).toBe(true);
	});

	it("denies agency plan at monitoring limit (100/100)", () => {
		const result = checkMonitoringQuota("agency", { promptsThisMonth: 100 });
		expect(result.allowed).toBe(false);
	});

	it("allows enterprise plan with any usage (unlimited)", () => {
		const result = checkMonitoringQuota("enterprise", { promptsThisMonth: 999999 });
		expect(result.allowed).toBe(true);
	});

	it("denies starter plan (feature not available)", () => {
		const result = checkMonitoringQuota("starter", { promptsThisMonth: 0 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("nicht verfügbar");
	});

	it("returns upgradeTo=pro for free plan monitoring denial", () => {
		const result = checkMonitoringQuota("free", { promptsThisMonth: 0 });
		expect(result.upgradeTo).toBe("pro");
	});

	it("returns upgradeTo=agency when pro limit exceeded", () => {
		const result = checkMonitoringQuota("pro", { promptsThisMonth: 25 });
		expect(result.upgradeTo).toBe("agency");
	});

	it("returns remaining=0 when over monitoring limit", () => {
		const result = checkMonitoringQuota("pro", { promptsThisMonth: 30 });
		expect(result.remaining).toBe(0);
	});
});

// ── canScan (boolean wrapper) ───────────────────────────────

describe("canScan", () => {
	it("returns true when under limit", () => {
		expect(canScan("free", { monthlyScansUsed: 0, dailyScansUsed: 0 })).toBe(true);
	});

	it("returns false when at limit", () => {
		expect(canScan("free", { monthlyScansUsed: 3, dailyScansUsed: 0 })).toBe(false);
	});
});

// ── canFix (boolean wrapper) ────────────────────────────────

describe("canFix", () => {
	it("returns false for free", () => {
		expect(canFix("free")).toBe(false);
	});

	it("returns true for starter", () => {
		expect(canFix("starter")).toBe(true);
	});

	it("returns true for pro", () => {
		expect(canFix("pro")).toBe(true);
	});

	it("returns true for agency", () => {
		expect(canFix("agency")).toBe(true);
	});

	it("returns true for enterprise", () => {
		expect(canFix("enterprise")).toBe(true);
	});
});

// ── checkDeploymentQuota ───────────────────────────────────

describe("checkDeploymentQuota", () => {
	it("denies free plan (feature not available)", () => {
		const result = checkDeploymentQuota("free", { deploymentsThisMonth: 0 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("nicht verfügbar");
		expect(result.upgradeTo).toBe("pro");
	});

	it("denies starter plan (feature not available)", () => {
		const result = checkDeploymentQuota("starter", { deploymentsThisMonth: 0 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("nicht verfügbar");
		expect(result.upgradeTo).toBe("pro");
	});

	it("allows pro plan within limit", () => {
		const result = checkDeploymentQuota("pro", { deploymentsThisMonth: 10 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(40);
	});

	it("denies pro plan at limit (50/50)", () => {
		const result = checkDeploymentQuota("pro", { deploymentsThisMonth: 50 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("Deployment-Limit");
		expect(result.upgradeTo).toBe("agency");
	});

	it("allows agency plan with unlimited deployments", () => {
		const result = checkDeploymentQuota("agency", { deploymentsThisMonth: 999999 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBeNull();
	});

	it("allows enterprise plan with unlimited deployments", () => {
		const result = checkDeploymentQuota("enterprise", { deploymentsThisMonth: 999999 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBeNull();
	});
});

// ── checkMonitoringProjectQuota (#270) ─────────────────────

describe("checkMonitoringProjectQuota", () => {
	it("denies free plan (limit 0)", () => {
		const result = checkMonitoringProjectQuota("free", { projectCount: 0 });
		expect(result.allowed).toBe(false);
	});

	it("denies starter plan (limit 0)", () => {
		const result = checkMonitoringProjectQuota("starter", { projectCount: 0 });
		expect(result.allowed).toBe(false);
	});

	it("allows pro plan within limit", () => {
		const result = checkMonitoringProjectQuota("pro", { projectCount: 2 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(1);
	});

	it("denies pro plan at limit", () => {
		const result = checkMonitoringProjectQuota("pro", { projectCount: 3 });
		expect(result.allowed).toBe(false);
	});

	it("allows enterprise unlimited", () => {
		const result = checkMonitoringProjectQuota("enterprise", { projectCount: 999 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBeNull();
	});
});

// ── checkCompetitorQuota (#270) ────────────────────────────

describe("checkCompetitorQuota", () => {
	it("denies free plan (limit 0)", () => {
		const result = checkCompetitorQuota("free", { competitorCount: 0 });
		expect(result.allowed).toBe(false);
	});

	it("allows pro plan within limit", () => {
		const result = checkCompetitorQuota("pro", { competitorCount: 2 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(1);
	});

	it("denies pro plan at limit", () => {
		const result = checkCompetitorQuota("pro", { competitorCount: 3 });
		expect(result.allowed).toBe(false);
	});

	it("allows agency within limit", () => {
		const result = checkCompetitorQuota("agency", { competitorCount: 15 });
		expect(result.allowed).toBe(true);
	});

	it("allows enterprise unlimited", () => {
		const result = checkCompetitorQuota("enterprise", { competitorCount: 999 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBeNull();
	});
});

// ── checkApiCallQuota (#308) ──────────────────────────────

describe("checkApiCallQuota", () => {
	it("denies free plan (apiAccess: false, limit 0)", () => {
		const result = checkApiCallQuota("free", { apiCallsThisMonth: 0 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("nicht verfügbar");
		expect(result.upgradeTo).toBe("agency");
	});

	it("denies starter plan (apiAccess: false, limit 0)", () => {
		const result = checkApiCallQuota("starter", { apiCallsThisMonth: 0 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("nicht verfügbar");
	});

	it("denies pro plan (apiAccess: false, limit 0)", () => {
		const result = checkApiCallQuota("pro", { apiCallsThisMonth: 0 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("nicht verfügbar");
	});

	it("allows agency plan within limit", () => {
		const result = checkApiCallQuota("agency", { apiCallsThisMonth: 5000 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(5000);
	});

	it("denies agency plan at limit (10000/10000)", () => {
		const result = checkApiCallQuota("agency", { apiCallsThisMonth: 10000 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("API-Aufruf-Limit erreicht");
		expect(result.current).toBe(10000);
		expect(result.limit).toBe(10000);
	});

	it("allows enterprise plan with unlimited calls", () => {
		const result = checkApiCallQuota("enterprise", { apiCallsThisMonth: 999999 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBeNull();
	});
});

// ── checkWebhookEndpointQuota (#308) ─────────────────────

describe("checkWebhookEndpointQuota", () => {
	it("denies free plan (webhooks: false, limit 0)", () => {
		const result = checkWebhookEndpointQuota("free", { endpointCount: 0 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("nicht verfügbar");
		expect(result.upgradeTo).toBe("agency");
	});

	it("denies starter plan (webhooks: false, limit 0)", () => {
		const result = checkWebhookEndpointQuota("starter", { endpointCount: 0 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("nicht verfügbar");
	});

	it("denies pro plan (webhooks: false, limit 0)", () => {
		const result = checkWebhookEndpointQuota("pro", { endpointCount: 0 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("nicht verfügbar");
	});

	it("allows agency plan within limit (< 5)", () => {
		const result = checkWebhookEndpointQuota("agency", { endpointCount: 3 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(2);
	});

	it("denies agency plan at limit (5/5)", () => {
		const result = checkWebhookEndpointQuota("agency", { endpointCount: 5 });
		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("Webhook-Endpunkt-Limit erreicht");
		expect(result.current).toBe(5);
		expect(result.limit).toBe(5);
	});

	it("allows enterprise plan with unlimited endpoints", () => {
		const result = checkWebhookEndpointQuota("enterprise", { endpointCount: 999 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBeNull();
	});
});

// ── canDeploy (boolean wrapper) ────────────────────────────

describe("canDeploy", () => {
	it("returns false for free", () => {
		expect(canDeploy("free")).toBe(false);
	});

	it("returns false for starter", () => {
		expect(canDeploy("starter")).toBe(false);
	});

	it("returns true for pro", () => {
		expect(canDeploy("pro")).toBe(true);
	});

	it("returns true for agency", () => {
		expect(canDeploy("agency")).toBe(true);
	});

	it("returns true for enterprise", () => {
		expect(canDeploy("enterprise")).toBe(true);
	});
});

// ── Binary Feature Guards ───────────────────────────────────

describe("binary feature guards", () => {
	const guardMatrix: [string, (plan: PlanName) => boolean, PlanName[]][] = [
		["canAccessDashboard", canAccessDashboard, ["starter", "pro", "agency", "enterprise"]],
		["canExportPdf", canExportPdf, ["starter", "pro", "agency", "enterprise"]],
		["canUseAiAnalysis", canUseAiAnalysis, ["pro", "agency", "enterprise"]],
		["canUseMonitoring", canUseMonitoring, ["pro", "agency", "enterprise"]],
		["canUseAlerts", canUseAlerts, ["pro", "agency", "enterprise"]],
		["canUseBatchScan", canUseBatchScan, ["agency", "enterprise"]],
		["canUseWhiteLabel", canUseWhiteLabel, ["agency", "enterprise"]],
		["canUseApi", canUseApi, ["agency", "enterprise"]],
		["canUseBenchmarking", canUseBenchmarking, ["agency", "enterprise"]],
		["canUseSso", canUseSso, ["enterprise"]],
		["canUseCsvExport", canUseCsvExport, ["starter", "pro", "agency", "enterprise"]],
		["canUseScoreSnapshots", canUseScoreSnapshots, ["starter", "pro", "agency", "enterprise"]],
		["canUseAiVisibilityMonitoring", canUseAiVisibilityMonitoring, ["pro", "agency", "enterprise"]],
		["canUseLlmCitationTracking", canUseLlmCitationTracking, ["pro", "agency", "enterprise"]],
		["canUseCompetitiveIntel", canUseCompetitiveIntel, ["pro", "agency", "enterprise"]],
		["canUseGuarantee", canUseGuarantee, ["pro", "agency", "enterprise"]],
		["canUseMultiLanguage", canUseMultiLanguage, ["agency", "enterprise"]],
		["canUseWebhooks", canUseWebhooks, ["agency", "enterprise"]],
		["canUseLookerStudio", canUseLookerStudio, ["agency", "enterprise"]],
		["canUseAffiliateProgram", canUseAffiliateProgram, ["agency", "enterprise"]],
		["canUseCustomReportBranding", canUseCustomReportBranding, ["enterprise"]],
	];

	for (const [name, guard, allowedPlans] of guardMatrix) {
		describe(name, () => {
			for (const plan of PLAN_NAMES) {
				const expected = allowedPlans.includes(plan);
				it(`returns ${expected} for ${plan}`, () => {
					expect(guard(plan)).toBe(expected);
				});
			}
		});
	}
});

// ── Meta-test: all guards return valid results for all plans ─

describe("guard completeness", () => {
	it("every quota guard returns a valid QuotaCheckResult for every plan", () => {
		for (const plan of PLAN_NAMES) {
			const scanResult = checkScanQuota(plan, { monthlyScansUsed: 0, dailyScansUsed: 0 });
			expect(typeof scanResult.allowed).toBe("boolean");
			expect(typeof scanResult.reason).toBe("string");

			const fixResult = checkFixQuota(plan, { fixesThisMonth: 0 });
			expect(typeof fixResult.allowed).toBe("boolean");

			const monResult = checkMonitoringQuota(plan, { promptsThisMonth: 0 });
			expect(typeof monResult.allowed).toBe("boolean");
		}
	});
});

describe("isSubscriptionActive", () => {
	it("returns true for free plan regardless of status", () => {
		expect(isSubscriptionActive("free", null)).toBe(true);
		expect(isSubscriptionActive("free", "past_due")).toBe(true);
		expect(isSubscriptionActive("free", undefined)).toBe(true);
	});

	it("returns true for active subscription", () => {
		expect(isSubscriptionActive("pro", "active")).toBe(true);
		expect(isSubscriptionActive("starter", "active")).toBe(true);
		expect(isSubscriptionActive("agency", "active")).toBe(true);
	});

	it("returns true for trialing subscription", () => {
		expect(isSubscriptionActive("starter", "trialing")).toBe(true);
	});

	it("returns false for past_due subscription", () => {
		expect(isSubscriptionActive("pro", "past_due")).toBe(false);
		expect(isSubscriptionActive("starter", "past_due")).toBe(false);
	});

	it("returns false for unpaid subscription", () => {
		expect(isSubscriptionActive("pro", "unpaid")).toBe(false);
	});

	it("returns false for canceled subscription", () => {
		expect(isSubscriptionActive("pro", "canceled")).toBe(false);
	});

	it("returns false for null/undefined status on paid plans", () => {
		expect(isSubscriptionActive("pro", null)).toBe(false);
		expect(isSubscriptionActive("starter", undefined)).toBe(false);
	});
});

describe("checkFeatureAccess", () => {
	it("returns null for allowed feature", () => {
		expect(checkFeatureAccess("pro", "fixGeneration", "active")).toBeNull();
	});

	it("returns FeatureGateResult for denied feature", () => {
		const result = checkFeatureAccess("free", "fixGeneration", undefined);
		expect(result).not.toBeNull();
		expect(result?.allowed).toBe(false);
		expect(result?.code).toBe("FEATURE_DENIED");
		expect(result?.upgradeTo).toBe("starter");
		expect(result?.error).toContain("Fix-Generierung");
	});

	it("returns SUBSCRIPTION_INACTIVE for inactive paid subscription", () => {
		const result = checkFeatureAccess("pro", "fixGeneration", "past_due");
		expect(result).not.toBeNull();
		expect(result?.code).toBe("SUBSCRIPTION_INACTIVE");
	});

	it("skips subscription check for free plan", () => {
		const result = checkFeatureAccess("free", "dashboard", undefined);
		expect(result).not.toBeNull();
		expect(result?.code).toBe("FEATURE_DENIED");
	});

	it("returns null for free plan with allowed feature (no subscription needed)", () => {
		// Free plan has no features enabled, so this tests a paid plan
		expect(checkFeatureAccess("starter", "dashboard", "active")).toBeNull();
	});
});
