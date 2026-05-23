import { PLAN_NAMES, type PlanName } from "@beacon/shared";
import { FEATURE_LABELS, PLAN_CONFIG } from "./plans.js";
import type { PlanTransition, TransitionType } from "./types.js";

// ── Plan Hierarchy ──────────────────────────────────────────

export function getPlanIndex(plan: PlanName): number {
	return PLAN_NAMES.indexOf(plan);
}

export function comparePlans(a: PlanName, b: PlanName): number {
	return getPlanIndex(a) - getPlanIndex(b);
}

export function getTransitionType(from: PlanName, to: PlanName): TransitionType {
	const diff = comparePlans(to, from);
	if (diff > 0) return "upgrade";
	if (diff < 0) return "downgrade";
	return "same";
}

export function isUpgrade(from: PlanName, to: PlanName): boolean {
	return getTransitionType(from, to) === "upgrade";
}

export function isDowngrade(from: PlanName, to: PlanName): boolean {
	return getTransitionType(from, to) === "downgrade";
}

// ── Transition Validation ───────────────────────────────────

export function getPlanTransition(from: PlanName, to: PlanName): PlanTransition {
	const type = getTransitionType(from, to);
	const fromIndex = getPlanIndex(from);
	const toIndex = getPlanIndex(to);

	return {
		from,
		to,
		type,
		requiresCheckout: type === "upgrade" && fromIndex === 0 && toIndex > 0,
		requiresCancellation: type === "downgrade" && toIndex === 0 && fromIndex > 0,
		requiresContactSales: from === "enterprise" || to === "enterprise",
	};
}

// ── Downgrade Warnings ──────────────────────────────────────

export function getDowngradeWarnings(from: PlanName, to: PlanName): string[] {
	if (getTransitionType(from, to) !== "downgrade") return [];

	const fromConfig = PLAN_CONFIG[from];
	const toConfig = PLAN_CONFIG[to];
	const warnings: string[] = [];

	// Check lost features
	for (const [key, label] of Object.entries(FEATURE_LABELS)) {
		const k = key as keyof typeof fromConfig.features;
		if (fromConfig.features[k] && !toConfig.features[k]) {
			warnings.push(`${label} ist im ${toConfig.displayName}-Plan nicht verfügbar`);
		}
	}

	// Check reduced limits
	const limitLabels: Array<{ key: keyof typeof fromConfig.limits; label: string }> = [
		{ key: "scansPerMonth", label: "Scan-Limit" },
		{ key: "monitoringPrompts", label: "Monitoring-Prompts" },
		{ key: "apiCallsPerMonth", label: "API-Aufrufe" },
		{ key: "crawlPagesPerJob", label: "Crawl-Seiten" },
		{ key: "teamMembers", label: "Team-Mitglieder" },
		{ key: "clientWorkspaces", label: "Client-Workspaces" },
		{ key: "citationChecksPerMonth", label: "Zitations-Checks" },
		{ key: "aiVisibilityChecksPerMonth", label: "KI-Sichtbarkeits-Checks" },
		{ key: "competitorBenchmarks", label: "Wettbewerber-Benchmarks" },
		{ key: "snapshotsPerMonth", label: "Score-Snapshots" },
		{ key: "webhookEndpoints", label: "Webhook-Endpoints" },
	];

	for (const { key, label } of limitLabels) {
		const fromLimit = fromConfig.limits[key];
		const toLimit = toConfig.limits[key];
		if (
			toLimit !== null &&
			toLimit !== 0 &&
			(fromLimit === null || (typeof fromLimit === "number" && fromLimit > toLimit))
		) {
			warnings.push(`${label} reduziert auf ${toLimit}`);
		}
	}

	return warnings;
}
