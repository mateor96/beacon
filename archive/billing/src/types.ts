import type { PlanName } from "@beacon/shared";

// ── Limit Type ──────────────────────────────────────────────

/** null = unlimited */
export type Limit = number | null;

// ── Plan Limits (numeric quotas) ────────────────────────────

export interface PlanLimits {
	/** Max scans per month. Resets monthly (calendar for free, billing-period for paid). null = unlimited. */
	scansPerMonth: Limit;
	/** Max scans per day (burst protection). null = unlimited. */
	scansPerDay: Limit;
	/** Max AI fix generations per month. null = unlimited. 0 = disabled. */
	fixesPerMonth: Limit;
	/** Max AI monitoring prompts per month. null = unlimited. 0 = disabled. */
	monitoringPrompts: Limit;
	/** Max monitoring projects. null = unlimited. 0 = disabled. */
	monitoringProjects: Limit;
	/** Max API calls per month. null = unlimited. 0 = disabled. */
	apiCallsPerMonth: Limit;
	/** Max pages per crawl job. null = unlimited. 0 = disabled. */
	crawlPagesPerJob: Limit;
	/** Max team members. null = unlimited. */
	teamMembers: Limit;
	/** Max client workspaces (agency multi-client). null = unlimited. 0 = disabled. */
	clientWorkspaces: Limit;
	/** Data retention in days. Always a concrete number. */
	retentionDays: number;
	/** Max LLM citation checks per month. null = unlimited. 0 = disabled. */
	citationChecksPerMonth: Limit;
	/** Max AI visibility checks per month. null = unlimited. 0 = disabled. */
	aiVisibilityChecksPerMonth: Limit;
	/** Max competitors per benchmark. null = unlimited. 0 = disabled. */
	competitorBenchmarks: Limit;
	/** Max score snapshots per month. null = unlimited. 0 = disabled. */
	snapshotsPerMonth: Limit;
	/** Max webhook endpoints. null = unlimited. 0 = disabled. */
	webhookEndpoints: Limit;
	/** Max CMS deployments per month. null = unlimited. 0 = disabled. */
	deploymentsPerMonth: Limit;
	/** Max locales per monitoring project (incl. primary). null = unlimited. */
	localesPerProject: Limit;
}

// ── Plan Features (boolean gates) ───────────────────────────

export interface PlanFeatures {
	dashboard: boolean;
	pdfReports: boolean;
	fixGeneration: boolean;
	aiAnalysis: boolean;
	alerts: boolean;
	whiteLabel: boolean;
	batchScan: boolean;
	apiAccess: boolean;
	benchmarking: boolean;
	sso: boolean;
	prioritySupport: boolean;
	sla: boolean;
	// New feature gates
	csvExport: boolean;
	scoreSnapshots: boolean;
	aiVisibilityMonitoring: boolean;
	llmCitationTracking: boolean;
	competitiveIntel: boolean;
	multiLanguage: boolean;
	redditTracking: boolean;
	webhooks: boolean;
	lookerStudio: boolean;
	customReportBranding: boolean;
	guaranteeEligible: boolean;
	affiliateProgram: boolean;
	fixDeployment: boolean;
}

// ── Plan Pricing ────────────────────────────────────────────

export interface PlanPricing {
	/** Monthly price in EUR cents (0 for free) */
	monthlyPriceCents: number;
	/** Yearly price in EUR cents (0 for free) */
	yearlyPriceCents: number;
}

// ── Plan Config (top-level per-plan object) ─────────────────

export interface PlanConfig {
	name: PlanName;
	displayName: string;
	description: string;
	order: number;
	pricing: PlanPricing;
	limits: PlanLimits;
	features: PlanFeatures;
}

// ── Guard Results ───────────────────────────────────────────

export interface QuotaCheckResult {
	allowed: boolean;
	/** German user-facing message */
	reason: string;
	/** The plan's limit for this resource (null = unlimited) */
	limit: Limit;
	/** Current usage count */
	current: number;
	/** Remaining quota (null = unlimited) */
	remaining: Limit;
	/** Cheapest plan that would allow this action */
	upgradeTo: PlanName | null;
}

// ── Usage Types ─────────────────────────────────────────────

export interface ScanUsage {
	monthlyScansUsed: number;
	dailyScansUsed: number;
}

export interface FixUsage {
	fixesThisMonth: number;
}

export interface MonitoringUsage {
	promptsThisMonth: number;
}

export interface DeploymentUsage {
	deploymentsThisMonth: number;
}

export interface ApiCallUsage {
	apiCallsThisMonth: number;
}

export interface WebhookEndpointUsage {
	endpointCount: number;
}

export interface LocaleUsage {
	/** Number of locales currently attached to the project / domain. */
	localeCount: number;
}

// ── Usage Summary (for dashboard display) ───────────────────

export interface UsageMetric {
	used: number;
	limit: Limit;
	remaining: Limit;
	percentage: number;
}

export interface UsageSummary {
	plan: PlanName;
	scans: { monthly: UsageMetric; daily: UsageMetric };
	fixes: UsageMetric;
	monitoring: UsageMetric;
}

// ── Transition Types ────────────────────────────────────────

export type TransitionType = "upgrade" | "downgrade" | "same";

export interface PlanTransition {
	from: PlanName;
	to: PlanName;
	type: TransitionType;
	requiresCheckout: boolean;
	requiresCancellation: boolean;
	requiresContactSales: boolean;
}

// ── Feature Gate Types ──────────────────────────────────────

export type FeatureName = keyof PlanFeatures;
export type LimitName = keyof PlanLimits;
export type FailBehavior = "open" | "closed";

export interface FeatureGateResult {
	allowed: false;
	error: string;
	code: "FEATURE_DENIED" | "SUBSCRIPTION_INACTIVE";
	feature: FeatureName;
	upgradeTo: PlanName;
}
