import {
	CHECK_METADATA_MAP,
	CHECK_WEIGHTS,
	CURRENT_READINESS_CHECK_IDS,
	type CheckCategory,
	type CheckId,
	type CheckScoreEntry,
	type ComparisonCategoryEntry,
	type ComparisonCheckEntry,
	type ComparisonResult,
	FUTURE_READINESS_CHECK_IDS,
	LEVEL_GATE_CHECKS,
	type LevelScores,
	MAX_SCORE,
	type ReadinessLevel,
	type ScanCheck,
	type ScoreBreakdown,
	scoreToLevel,
} from "@beacon/shared";

const CATEGORIES: readonly CheckCategory[] = [
	"readability",
	"interactivity",
	"transactional",
] as const;

// Minimum score a gate check must have to count as "passed" for level gating
const GATE_PASS_THRESHOLD = 50;

/**
 * Weighted-average overall score.
 * overallScore = round(SUM(check.score * weight) / totalWeight)
 *
 * Uses check.score (numeric 0-100), NOT check.status. The status string
 * ("pass"/"warn"/"fail") is purely informational. A "warn" check with
 * score=60 contributes exactly 60 × weight — partial credit.
 *
 * Checks with status "error" (crashed during execution) are excluded from
 * both numerator and denominator. A crash means the check could not run —
 * it should not penalize the score as if the site genuinely failed.
 *
 * Returns 0 for empty checks (no data = no readiness evidence).
 * Only checks with an entry in CHECK_WEIGHTS are included.
 */
export function calculateOverallScore(checks: ScanCheck[]): number {
	if (checks.length === 0) return 0;

	let totalWeight = 0;
	let weightedSum = 0;

	for (const check of checks) {
		if (check.status === "error") continue;
		const weight = CHECK_WEIGHTS[check.id];
		if (weight === undefined) {
			console.warn(`[scoring] Unknown check id "${check.id}", skipping weight`);
			continue;
		}
		const clampedScore = Math.max(0, Math.min(MAX_SCORE, check.score));
		totalWeight += weight;
		weightedSum += clampedScore * weight;
	}

	if (totalWeight === 0) return 0;

	return Math.max(0, Math.min(MAX_SCORE, Math.round(weightedSum / totalWeight)));
}

/**
 * Category-level scores using weighted average within each category.
 * Returns null for categories with no checks (null = not evaluated).
 *
 * The "transactional" category has 0 checks in MVP scope (UCP/ACP deferred
 * to Phase 6) and will always be null until real checks are added.
 */
export function calculateLevelScores(checks: ScanCheck[]): LevelScores {
	const scores: LevelScores = {
		readability: null,
		interactivity: null,
		transactional: null,
	};

	const checksByCategory: Record<CheckCategory, ScanCheck[]> = {
		readability: [],
		interactivity: [],
		transactional: [],
	};

	for (const check of checks) {
		if (check.status === "error") continue;
		const meta = CHECK_METADATA_MAP[check.id];
		if (!meta) {
			console.warn(`[scoring] Unknown check id "${check.id}", skipping`);
			continue;
		}
		checksByCategory[meta.category].push(check);
	}

	for (const category of CATEGORIES) {
		const categoryChecks = checksByCategory[category];

		if (categoryChecks.length === 0) {
			continue; // Keep null default — not evaluated
		}

		let totalWeight = 0;
		let weightedSum = 0;

		for (const check of categoryChecks) {
			const weight = CHECK_WEIGHTS[check.id] ?? 0;
			const clampedScore = Math.max(0, Math.min(MAX_SCORE, check.score));
			totalWeight += weight;
			weightedSum += clampedScore * weight;
		}

		scores[category] =
			totalWeight > 0
				? Math.max(0, Math.min(MAX_SCORE, Math.round(weightedSum / totalWeight)))
				: null;
	}

	return scores;
}

/**
 * Hybrid readiness level: score thresholds + gate checks.
 * The score threshold sets the ceiling. Gate checks can only lower
 * the level, never raise it.
 */
export function calculateReadinessLevel(overallScore: number, checks: ScanCheck[]): ReadinessLevel {
	const thresholdLevel = scoreToLevel(overallScore);

	if (checks.length === 0) return thresholdLevel;

	const checkScoreMap = new Map<CheckId, number>();
	for (const check of checks) {
		if (check.status === "error") continue;
		checkScoreMap.set(check.id, check.score);
	}

	// Walk down from thresholdLevel to find highest level where all gates pass
	for (let level = thresholdLevel; level >= 0; level--) {
		if (allGatesPassed(level as ReadinessLevel, checkScoreMap)) {
			return level as ReadinessLevel;
		}
	}

	return 0;
}

function allGatesPassed(level: ReadinessLevel, checkScoreMap: Map<CheckId, number>): boolean {
	// Must pass gates for this level AND all lower levels
	for (let l = 1; l <= level; l++) {
		const gateChecks = LEVEL_GATE_CHECKS[l as ReadinessLevel];
		for (const checkId of gateChecks) {
			const score = checkScoreMap.get(checkId);
			// undefined = check not present or crashed → skip (not evaluated)
			if (score === undefined) continue;
			if (score < GATE_PASS_THRESHOLD) {
				return false;
			}
		}
	}
	return true;
}

/**
 * Current Readiness: weighted average of Foundation + Established tier checks only.
 * Represents "how ready is your site with established standards today."
 * Returns 0 for empty/all-error checks.
 */
export function calculateCurrentReadiness(checks: ScanCheck[]): number {
	const idSet = new Set<string>(CURRENT_READINESS_CHECK_IDS);
	const filtered = checks.filter((c) => idSet.has(c.id));
	return calculateOverallScore(filtered);
}

/**
 * Future Readiness: weighted average of Advanced + Bleeding-edge tier checks only.
 * Represents "how prepared are you for emerging AI standards."
 * Returns 0 for empty/all-error checks.
 */
export function calculateFutureReadiness(checks: ScanCheck[]): number {
	const idSet = new Set<string>(FUTURE_READINESS_CHECK_IDS);
	const filtered = checks.filter((c) => idSet.has(c.id));
	return calculateOverallScore(filtered);
}

/**
 * Compare two scan results: primary site vs competitor.
 * Returns per-check deltas, per-category comparison, and summary stats.
 * Error-status checks are excluded from comparison (consistent with scoring).
 */
export function calculateComparison(
	primaryChecks: ScanCheck[],
	competitorChecks: ScanCheck[],
): ComparisonResult {
	// Filter out error-status checks
	const primary = primaryChecks.filter((c) => c.status !== "error");
	const competitor = competitorChecks.filter((c) => c.status !== "error");

	// Build lookup maps
	const primaryMap = new Map(primary.map((c) => [c.id, c]));
	const competitorMap = new Map(competitor.map((c) => [c.id, c]));

	// Find all check IDs present in BOTH arrays
	const commonIds = [...primaryMap.keys()].filter((id) => competitorMap.has(id));

	// Per-check comparison
	const checkEntries: ComparisonCheckEntry[] = commonIds.flatMap((id) => {
		const primaryCheck = primaryMap.get(id);
		const competitorCheck = competitorMap.get(id);
		if (!primaryCheck || !competitorCheck) return [];
		const pScore = primaryCheck.score;
		const cScore = competitorCheck.score;
		const delta = pScore - cScore;
		return [
			{
				checkId: id,
				primaryScore: pScore,
				competitorScore: cScore,
				delta,
				result: delta > 0 ? "won" : delta < 0 ? "lost" : "tied",
			},
		];
	});

	// Per-category comparison using calculateLevelScores
	const primaryLevels = calculateLevelScores(primary);
	const competitorLevels = calculateLevelScores(competitor);

	const categories: CheckCategory[] = ["readability", "interactivity", "transactional"];
	const categoryEntries: ComparisonCategoryEntry[] = categories.map((cat) => {
		const pScore = primaryLevels[cat];
		const cScore = competitorLevels[cat];
		const delta = (pScore ?? 0) - (cScore ?? 0);
		return {
			category: cat,
			primaryScore: pScore,
			competitorScore: cScore,
			delta,
			result:
				pScore === null && cScore === null
					? "tied"
					: delta > 0
						? "won"
						: delta < 0
							? "lost"
							: "tied",
		};
	});

	// Summary
	const primaryOverall = calculateOverallScore(primary);
	const competitorOverall = calculateOverallScore(competitor);

	return {
		checkEntries,
		categoryEntries,
		summary: {
			primaryOverallScore: primaryOverall,
			competitorOverallScore: competitorOverall,
			overallDelta: primaryOverall - competitorOverall,
			checksWon: checkEntries.filter((e) => e.result === "won").length,
			checksLost: checkEntries.filter((e) => e.result === "lost").length,
			checksTied: checkEntries.filter((e) => e.result === "tied").length,
		},
	};
}

/**
 * Compute a full score breakdown from check results.
 * This is a read-time computation, not stored in DB.
 */
export function calculateScoreBreakdown(checks: ScanCheck[]): ScoreBreakdown {
	const overallScore = calculateOverallScore(checks);
	const levelScores = calculateLevelScores(checks);
	const readinessLevel = calculateReadinessLevel(overallScore, checks);

	let totalWeight = 0;
	const checkEntries: CheckScoreEntry[] = [];

	for (const check of checks) {
		if (check.status === "error") continue;
		const weight = CHECK_WEIGHTS[check.id] ?? 0;
		const clampedScore = Math.max(0, Math.min(MAX_SCORE, check.score));
		totalWeight += weight;
		checkEntries.push({
			checkId: check.id,
			score: clampedScore,
			weight,
			weightedScore: 0, // computed below
		});
	}

	// Compute weightedScore as the contribution to the overall percentage
	for (const entry of checkEntries) {
		entry.weightedScore =
			totalWeight > 0 ? Math.round((entry.score * entry.weight * 100) / totalWeight) / 100 : 0;
	}

	return {
		overallScore,
		readinessLevel,
		levelScores,
		checks: checkEntries,
		totalWeight,
		currentReadiness: calculateCurrentReadiness(checks),
		futureReadiness: calculateFutureReadiness(checks),
	};
}
