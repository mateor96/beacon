import type { PlanName } from "@beacon/shared";
import { PLAN_CONFIG } from "./plans.js";
import type {
	FixUsage,
	Limit,
	MonitoringUsage,
	ScanUsage,
	UsageMetric,
	UsageSummary,
} from "./types.js";

// ── Empty Usage (for testing) ───────────────────────────────

export const EMPTY_SCAN_USAGE: ScanUsage = {
	monthlyScansUsed: 0,
	dailyScansUsed: 0,
};

export const EMPTY_FIX_USAGE: FixUsage = {
	fixesThisMonth: 0,
};

export const EMPTY_MONITORING_USAGE: MonitoringUsage = {
	promptsThisMonth: 0,
};

// ── Usage Builder ───────────────────────────────────────────

/**
 * Build ScanUsage from a profile-like object.
 * Accepts a structural type so billing stays decoupled from @beacon/db.
 */
export function buildScanUsage(profile: {
	monthlyScansUsed: number;
	dailyScansUsed: number;
}): ScanUsage {
	return {
		monthlyScansUsed: profile.monthlyScansUsed,
		dailyScansUsed: profile.dailyScansUsed,
	};
}

// ── Usage Summary (for dashboard) ───────────────────────────

function computeMetric(used: number, limit: Limit): UsageMetric {
	if (limit === null) {
		return { used, limit: null, remaining: null, percentage: 0 };
	}
	const remaining = Math.max(0, limit - used);
	const percentage = limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
	return { used, limit, remaining, percentage };
}

export function getUsageSummary(
	plan: PlanName,
	scanUsage: ScanUsage,
	fixUsage: FixUsage,
	monitoringUsage: MonitoringUsage,
): UsageSummary {
	const { limits } = PLAN_CONFIG[plan];

	return {
		plan,
		scans: {
			monthly: computeMetric(scanUsage.monthlyScansUsed, limits.scansPerMonth),
			daily: computeMetric(scanUsage.dailyScansUsed, limits.scansPerDay),
		},
		fixes: computeMetric(fixUsage.fixesThisMonth, limits.fixesPerMonth),
		monitoring: computeMetric(monitoringUsage.promptsThisMonth, limits.monitoringPrompts),
	};
}
