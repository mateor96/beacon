/**
 * Automated milestone detection engine (#274).
 *
 * Pure function — no DB access, no side effects. Takes structured snapshot
 * data as input, returns detected milestones as output. The worker
 * orchestrates DB reads, calls this function, and persists results.
 *
 * Strategy pattern: each rule is evaluated against the current context.
 * Rules are checked iteratively; existing milestones are passed in to
 * prevent duplicates at the application level.
 */

// ── Types ──────────────────────────────────────────────────

export interface MilestoneDetectionContext {
	projectId: string;
	snapshotId: string;
	/** Current overall score (0-100). */
	currentScore: number;
	/** Most recent previous overall score, or null if first scan. */
	previousScore: number | null;
	/** Baseline snapshot overall score, or null if no baseline. */
	baselineScore: number | null;
	/** Current citation count from the snapshot. */
	currentCitationCount: number;
	/** Baseline citation count, or null. */
	baselineCitationCount: number | null;
	/** AI platforms where the brand has been mentioned. */
	currentPlatforms: string[];
	/** Days since baseline snapshot was created, or null. */
	daysSinceBaseline: number | null;
	/** Already-triggered milestones for this project (for dedup). */
	existingMilestones: ExistingMilestone[];
}

export interface ExistingMilestone {
	milestoneType: string;
	milestoneData: Record<string, unknown>;
}

export interface DetectedMilestone {
	milestoneType: "score_threshold" | "citation_milestone" | "first_mention" | "improvement_rate";
	milestoneData: {
		threshold?: number;
		previousValue?: number;
		currentValue?: number;
		description: string;
		platform?: string;
	};
}

export interface MilestoneRuleConfig {
	scoreThresholds: number[];
	improvementRateMinPercent: number;
	improvementRateWindowDays: number;
}

export const DEFAULT_MILESTONE_CONFIG: MilestoneRuleConfig = {
	scoreThresholds: [25, 50, 75, 90],
	improvementRateMinPercent: 20,
	improvementRateWindowDays: 30,
};

// ── Helper: check if a milestone already exists ────────────

function hasExistingMilestone(
	existing: ExistingMilestone[],
	type: string,
	key: string,
	value: string | number,
): boolean {
	return existing.some(
		(m) =>
			m.milestoneType === type &&
			String((m.milestoneData as Record<string, unknown>)[key]) === String(value),
	);
}

// ── Rule 1: Score Threshold ────────────────────────────────

function evaluateScoreThresholds(
	ctx: MilestoneDetectionContext,
	config: MilestoneRuleConfig,
): DetectedMilestone[] {
	const results: DetectedMilestone[] = [];
	const previousScore = ctx.previousScore ?? 0;

	for (const threshold of config.scoreThresholds) {
		if (ctx.currentScore >= threshold && previousScore < threshold) {
			if (
				!hasExistingMilestone(ctx.existingMilestones, "score_threshold", "threshold", threshold)
			) {
				results.push({
					milestoneType: "score_threshold",
					milestoneData: {
						threshold,
						previousValue: previousScore,
						currentValue: ctx.currentScore,
						description: `Score hat ${threshold} Punkte erreicht`,
					},
				});
			}
		}
	}

	return results;
}

// ── Rule 2: Citation Milestone ─────────────────────────────

function evaluateCitationMilestones(ctx: MilestoneDetectionContext): DetectedMilestone[] {
	const results: DetectedMilestone[] = [];
	const current = ctx.currentCitationCount;
	const baseline = ctx.baselineCitationCount ?? 0;

	// First citation
	if (current > 0 && baseline === 0) {
		if (
			!hasExistingMilestone(
				ctx.existingMilestones,
				"citation_milestone",
				"description",
				"Erste KI-Zitierung",
			)
		) {
			results.push({
				milestoneType: "citation_milestone",
				milestoneData: {
					threshold: 1,
					previousValue: 0,
					currentValue: current,
					description: "Erste KI-Zitierung",
				},
			});
		}
	}

	// Doubled
	if (baseline > 0 && current >= baseline * 2) {
		if (
			!hasExistingMilestone(
				ctx.existingMilestones,
				"citation_milestone",
				"description",
				"Zitierungen verdoppelt",
			)
		) {
			results.push({
				milestoneType: "citation_milestone",
				milestoneData: {
					threshold: 2,
					previousValue: baseline,
					currentValue: current,
					description: "Zitierungen verdoppelt",
				},
			});
		}
	}

	// 10x
	if (baseline > 0 && current >= baseline * 10) {
		if (
			!hasExistingMilestone(
				ctx.existingMilestones,
				"citation_milestone",
				"description",
				"Zitierungen verzehnfacht",
			)
		) {
			results.push({
				milestoneType: "citation_milestone",
				milestoneData: {
					threshold: 10,
					previousValue: baseline,
					currentValue: current,
					description: "Zitierungen verzehnfacht",
				},
			});
		}
	}

	return results;
}

// ── Rule 3: First Mention per Platform ─────────────────────

function evaluateFirstMentions(ctx: MilestoneDetectionContext): DetectedMilestone[] {
	const results: DetectedMilestone[] = [];
	const seen = new Set<string>();

	for (const platform of ctx.currentPlatforms) {
		if (seen.has(platform)) continue;
		seen.add(platform);

		if (!hasExistingMilestone(ctx.existingMilestones, "first_mention", "platform", platform)) {
			results.push({
				milestoneType: "first_mention",
				milestoneData: {
					platform,
					currentValue: 1,
					description: `Erste Erwähnung auf ${platform}`,
				},
			});
		}
	}

	return results;
}

// ── Rule 4: Improvement Rate ───────────────────────────────

function evaluateImprovementRate(
	ctx: MilestoneDetectionContext,
	config: MilestoneRuleConfig,
): DetectedMilestone[] {
	if (ctx.baselineScore === null || ctx.baselineScore === 0) return [];
	if (ctx.daysSinceBaseline === null || ctx.daysSinceBaseline < 1) return [];
	if (ctx.daysSinceBaseline > config.improvementRateWindowDays * 2) return [];

	const percentChange = ((ctx.currentScore - ctx.baselineScore) / ctx.baselineScore) * 100;
	if (percentChange < config.improvementRateMinPercent) return [];

	// Check cooldown: only one improvement_rate milestone allowed
	const hasExisting = ctx.existingMilestones.some((m) => m.milestoneType === "improvement_rate");
	if (hasExisting) return [];

	return [
		{
			milestoneType: "improvement_rate",
			milestoneData: {
				threshold: Math.round(percentChange),
				previousValue: ctx.baselineScore,
				currentValue: ctx.currentScore,
				description: `Score um ${Math.round(percentChange)}% verbessert in ${ctx.daysSinceBaseline} Tagen`,
			},
		},
	];
}

// ── Public API ──────────────────────────────────────────────

/**
 * Detect milestones for a given snapshot context. Pure function — call
 * from the worker after fetching context data from the database.
 *
 * @returns Array of detected milestones (may be empty).
 */
export function detectMilestones(
	ctx: MilestoneDetectionContext,
	config: MilestoneRuleConfig = DEFAULT_MILESTONE_CONFIG,
): DetectedMilestone[] {
	const results: DetectedMilestone[] = [];

	// Run all rules, collecting results. Each rule handles its own dedup.
	try {
		results.push(...evaluateScoreThresholds(ctx, config));
	} catch {
		// Non-critical: one failing rule does not block others
	}

	try {
		results.push(...evaluateCitationMilestones(ctx));
	} catch {
		// Non-critical
	}

	try {
		results.push(...evaluateFirstMentions(ctx));
	} catch {
		// Non-critical
	}

	try {
		results.push(...evaluateImprovementRate(ctx, config));
	} catch {
		// Non-critical
	}

	return results;
}
