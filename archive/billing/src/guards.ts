import type { PlanName } from "@beacon/shared";
import {
	FEATURE_LABELS,
	PLAN_CONFIG,
	findMinimumPlanFor,
	findMinimumPlanForLimit,
	isWithinLimit,
} from "./plans.js";
import type {
	ApiCallUsage,
	DeploymentUsage,
	FeatureGateResult,
	FeatureName,
	FixUsage,
	Limit,
	LocaleUsage,
	MonitoringUsage,
	PlanFeatures,
	QuotaCheckResult,
	ScanUsage,
	WebhookEndpointUsage,
} from "./types.js";

// ── Quota Check Helpers ─────────────────────────────────────

function allowed(current: number, limit: Limit): QuotaCheckResult {
	return {
		allowed: true,
		reason: "ok",
		limit,
		current,
		remaining: limit === null ? null : limit - current,
		upgradeTo: null,
	};
}

function denied(
	reason: string,
	current: number,
	limit: number,
	upgradeTo: PlanName | null,
): QuotaCheckResult {
	return {
		allowed: false,
		reason,
		limit,
		current,
		remaining: Math.max(0, limit - current),
		upgradeTo,
	};
}

// ── Quota Guards (rich result) ──────────────────────────────

export function checkScanQuota(plan: PlanName, usage: ScanUsage): QuotaCheckResult {
	const { limits } = PLAN_CONFIG[plan];

	// Monthly check first (more likely to block)
	if (!isWithinLimit(usage.monthlyScansUsed, limits.scansPerMonth)) {
		return denied(
			`Monatliches Scan-Limit erreicht (${usage.monthlyScansUsed}/${limits.scansPerMonth})`,
			usage.monthlyScansUsed,
			limits.scansPerMonth as number,
			findMinimumPlanForLimit("scansPerMonth", usage.monthlyScansUsed + 1),
		);
	}

	// Daily check
	if (!isWithinLimit(usage.dailyScansUsed, limits.scansPerDay)) {
		return denied(
			`Tägliches Scan-Limit erreicht (${usage.dailyScansUsed}/${limits.scansPerDay})`,
			usage.dailyScansUsed,
			limits.scansPerDay as number,
			null,
		);
	}

	return allowed(usage.monthlyScansUsed, limits.scansPerMonth);
}

export function checkFixQuota(plan: PlanName, usage: FixUsage): QuotaCheckResult {
	const { limits, features } = PLAN_CONFIG[plan];

	if (!features.fixGeneration) {
		return denied(
			"Fix-Generierung ist in Ihrem Plan nicht verfügbar",
			usage.fixesThisMonth,
			0,
			findMinimumPlanFor("fixGeneration"),
		);
	}

	if (!isWithinLimit(usage.fixesThisMonth, limits.fixesPerMonth)) {
		return denied(
			`Monatliches Fix-Limit erreicht (${usage.fixesThisMonth}/${limits.fixesPerMonth})`,
			usage.fixesThisMonth,
			limits.fixesPerMonth as number,
			findMinimumPlanForLimit("fixesPerMonth", usage.fixesThisMonth + 1),
		);
	}

	return allowed(usage.fixesThisMonth, limits.fixesPerMonth);
}

export function checkMonitoringQuota(plan: PlanName, usage: MonitoringUsage): QuotaCheckResult {
	const { limits, features } = PLAN_CONFIG[plan];

	if (!features.alerts) {
		return denied(
			"Monitoring ist in Ihrem Plan nicht verfügbar",
			usage.promptsThisMonth,
			0,
			findMinimumPlanFor("alerts"),
		);
	}

	if (!isWithinLimit(usage.promptsThisMonth, limits.monitoringPrompts)) {
		return denied(
			`Monitoring-Prompt-Limit erreicht (${usage.promptsThisMonth}/${limits.monitoringPrompts})`,
			usage.promptsThisMonth,
			limits.monitoringPrompts as number,
			findMinimumPlanForLimit("monitoringPrompts", usage.promptsThisMonth + 1),
		);
	}

	return allowed(usage.promptsThisMonth, limits.monitoringPrompts);
}

export function checkDeploymentQuota(plan: PlanName, usage: DeploymentUsage): QuotaCheckResult {
	const { limits, features } = PLAN_CONFIG[plan];

	if (!features.fixDeployment) {
		return denied(
			"Fix-Deployment ist in Ihrem Plan nicht verfügbar",
			usage.deploymentsThisMonth,
			0,
			findMinimumPlanFor("fixDeployment"),
		);
	}

	if (!isWithinLimit(usage.deploymentsThisMonth, limits.deploymentsPerMonth)) {
		return denied(
			`Monatliches Deployment-Limit erreicht (${usage.deploymentsThisMonth}/${limits.deploymentsPerMonth})`,
			usage.deploymentsThisMonth,
			limits.deploymentsPerMonth as number,
			findMinimumPlanForLimit("deploymentsPerMonth", usage.deploymentsThisMonth + 1),
		);
	}

	return allowed(usage.deploymentsThisMonth, limits.deploymentsPerMonth);
}

export function checkMonitoringProjectQuota(
	plan: PlanName,
	usage: { projectCount: number },
): QuotaCheckResult {
	const { limits } = PLAN_CONFIG[plan];
	if (!isWithinLimit(usage.projectCount, limits.monitoringProjects)) {
		return denied(
			`Monitoring-Projekt-Limit erreicht (${usage.projectCount}/${limits.monitoringProjects})`,
			usage.projectCount,
			limits.monitoringProjects as number,
			findMinimumPlanForLimit("monitoringProjects", usage.projectCount + 1),
		);
	}
	return allowed(usage.projectCount, limits.monitoringProjects);
}

export function checkCompetitorQuota(
	plan: PlanName,
	usage: { competitorCount: number },
): QuotaCheckResult {
	const { limits } = PLAN_CONFIG[plan];
	if (!isWithinLimit(usage.competitorCount, limits.competitorBenchmarks)) {
		return denied(
			`Wettbewerber-Limit erreicht (${usage.competitorCount}/${limits.competitorBenchmarks})`,
			usage.competitorCount,
			limits.competitorBenchmarks as number,
			findMinimumPlanForLimit("competitorBenchmarks", usage.competitorCount + 1),
		);
	}
	return allowed(usage.competitorCount, limits.competitorBenchmarks);
}

export function checkApiCallQuota(plan: PlanName, usage: ApiCallUsage): QuotaCheckResult {
	const { limits, features } = PLAN_CONFIG[plan];

	if (!features.apiAccess) {
		return denied(
			"API-Zugang ist in Ihrem Plan nicht verfügbar",
			usage.apiCallsThisMonth,
			0,
			findMinimumPlanFor("apiAccess"),
		);
	}

	if (!isWithinLimit(usage.apiCallsThisMonth, limits.apiCallsPerMonth)) {
		return denied(
			`API-Aufruf-Limit erreicht (${usage.apiCallsThisMonth}/${limits.apiCallsPerMonth})`,
			usage.apiCallsThisMonth,
			limits.apiCallsPerMonth as number,
			findMinimumPlanForLimit("apiCallsPerMonth", usage.apiCallsThisMonth + 1),
		);
	}

	return allowed(usage.apiCallsThisMonth, limits.apiCallsPerMonth);
}

export function checkWebhookEndpointQuota(
	plan: PlanName,
	usage: WebhookEndpointUsage,
): QuotaCheckResult {
	const { limits, features } = PLAN_CONFIG[plan];

	if (!features.webhooks) {
		return denied(
			"Webhooks ist in Ihrem Plan nicht verfügbar",
			usage.endpointCount,
			0,
			findMinimumPlanFor("webhooks"),
		);
	}

	if (!isWithinLimit(usage.endpointCount, limits.webhookEndpoints)) {
		return denied(
			`Webhook-Endpunkt-Limit erreicht (${usage.endpointCount}/${limits.webhookEndpoints})`,
			usage.endpointCount,
			limits.webhookEndpoints as number,
			findMinimumPlanForLimit("webhookEndpoints", usage.endpointCount + 1),
		);
	}

	return allowed(usage.endpointCount, limits.webhookEndpoints);
}

/**
 * Locale-tracking quota guard (#257). Checks how many locales are already
 * attached vs the plan's `localesPerProject` limit. Adding the first locale
 * is always allowed (it represents the implicit primary). Plans without
 * the `multiLanguage` feature have an effective hard cap of 1 (the limit
 * itself enforces this without requiring a separate feature check).
 */
export function checkLocaleQuota(plan: PlanName, usage: LocaleUsage): QuotaCheckResult {
	const { limits } = PLAN_CONFIG[plan];

	if (!isWithinLimit(usage.localeCount, limits.localesPerProject)) {
		return denied(
			`Locale-Limit erreicht (${usage.localeCount}/${limits.localesPerProject}). Bitte upgraden, um weitere Locales zu tracken.`,
			usage.localeCount,
			limits.localesPerProject as number,
			findMinimumPlanForLimit("localesPerProject", usage.localeCount + 1),
		);
	}

	return allowed(usage.localeCount, limits.localesPerProject);
}

/**
 * Convenience boolean for UI buttons / disabled states. Equivalent to
 * `checkLocaleQuota(plan, usage).allowed`.
 */
export function canAddLocale(plan: PlanName, usage: LocaleUsage): boolean {
	return checkLocaleQuota(plan, usage).allowed;
}

// ── Binary Guards (boolean) ─────────────────────────────────

function checkFeature(plan: PlanName, feature: keyof PlanFeatures): boolean {
	return PLAN_CONFIG[plan].features[feature];
}

/** All plans can scan — this is a thin wrapper that checks quota as boolean */
export function canScan(plan: PlanName, usage: ScanUsage): boolean {
	return checkScanQuota(plan, usage).allowed;
}

/** Check if the plan allows fix generation (feature gate only) */
export function canFix(plan: PlanName): boolean {
	return checkFeature(plan, "fixGeneration");
}

export function canDeploy(plan: PlanName): boolean {
	return checkFeature(plan, "fixDeployment");
}

export function canAccessDashboard(plan: PlanName): boolean {
	return checkFeature(plan, "dashboard");
}

export function canExportPdf(plan: PlanName): boolean {
	return checkFeature(plan, "pdfReports");
}

export function canUseAiAnalysis(plan: PlanName): boolean {
	return checkFeature(plan, "aiAnalysis");
}

export function canUseMonitoring(plan: PlanName): boolean {
	return checkFeature(plan, "alerts");
}

export function canUseAlerts(plan: PlanName): boolean {
	return checkFeature(plan, "alerts");
}

export function canUseBatchScan(plan: PlanName): boolean {
	return checkFeature(plan, "batchScan");
}

export function canUseWhiteLabel(plan: PlanName): boolean {
	return checkFeature(plan, "whiteLabel");
}

export function canUseApi(plan: PlanName): boolean {
	return checkFeature(plan, "apiAccess");
}

export function canUseBenchmarking(plan: PlanName): boolean {
	return checkFeature(plan, "benchmarking");
}

export function canUseSso(plan: PlanName): boolean {
	return checkFeature(plan, "sso");
}

export function canUseCsvExport(plan: PlanName): boolean {
	return checkFeature(plan, "csvExport");
}

export function canUseScoreSnapshots(plan: PlanName): boolean {
	return checkFeature(plan, "scoreSnapshots");
}

export function canUseAiVisibilityMonitoring(plan: PlanName): boolean {
	return checkFeature(plan, "aiVisibilityMonitoring");
}

export function canUseLlmCitationTracking(plan: PlanName): boolean {
	return checkFeature(plan, "llmCitationTracking");
}

export function canUseCompetitiveIntel(plan: PlanName): boolean {
	return checkFeature(plan, "competitiveIntel");
}

export function canUseMultiLanguage(plan: PlanName): boolean {
	return checkFeature(plan, "multiLanguage");
}

export function canUseRedditTracking(plan: PlanName): boolean {
	return checkFeature(plan, "redditTracking");
}

export function canUseWebhooks(plan: PlanName): boolean {
	return checkFeature(plan, "webhooks");
}

export function canUseLookerStudio(plan: PlanName): boolean {
	return checkFeature(plan, "lookerStudio");
}

export function canUseCustomReportBranding(plan: PlanName): boolean {
	return checkFeature(plan, "customReportBranding");
}

export function canUseGuarantee(plan: PlanName): boolean {
	return checkFeature(plan, "guaranteeEligible");
}

export function canUseAffiliateProgram(plan: PlanName): boolean {
	return checkFeature(plan, "affiliateProgram");
}

// ── Subscription Status Guard ───────────────────────────────

/**
 * Check if a user's subscription is in good standing.
 * Free users always pass (no subscription needed).
 * Paid users must have an active or trialing subscription status.
 */
export function isSubscriptionActive(
	plan: PlanName,
	subscriptionStatus: string | null | undefined,
): boolean {
	if (plan === "free") return true;
	return subscriptionStatus === "active" || subscriptionStatus === "trialing";
}

// ── Unified Feature Gate ────────────────────────────────────

/**
 * Unified feature gate check. Returns null if allowed,
 * or a FeatureGateResult describing why access was denied.
 */
export function checkFeatureAccess(
	plan: PlanName,
	feature: FeatureName,
	subscriptionStatus?: string | null,
): FeatureGateResult | null {
	// Check subscription first (skip for free plan)
	if (!isSubscriptionActive(plan, subscriptionStatus)) {
		return {
			allowed: false,
			error: "Ihr Abonnement ist nicht aktiv. Bitte aktualisieren Sie Ihre Zahlungsinformationen.",
			code: "SUBSCRIPTION_INACTIVE",
			feature,
			upgradeTo: plan,
		};
	}

	if (!checkFeature(plan, feature)) {
		const featureLabel = FEATURE_LABELS[feature];
		return {
			allowed: false,
			error: `${featureLabel} ist in Ihrem Plan nicht verfügbar.`,
			code: "FEATURE_DENIED",
			feature,
			upgradeTo: findMinimumPlanFor(feature),
		};
	}

	return null; // allowed
}
