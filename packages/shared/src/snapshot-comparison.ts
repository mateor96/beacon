/**
 * Pure function to compute a side-by-side comparison between two score snapshots.
 * No DB access — operates on plain objects only.
 *
 * @module snapshot-comparison (#307)
 */

// ── Types ────────────────────────────────────────────────────

export type ComparisonDirection = "improved" | "regressed" | "unchanged";

export interface SubScoreDelta {
	category: "readability" | "interactivity" | "transactional";
	before: number | null;
	after: number | null;
	delta: number | null;
	direction: ComparisonDirection;
}

export interface SnapshotComparisonResult {
	overallScoreDelta: number;
	overallPercentageChange: number | null;
	overallDirection: ComparisonDirection;
	readinessLevelBefore: number;
	readinessLevelAfter: number;
	readinessLevelDelta: number;
	readinessDirection: ComparisonDirection;
	subScoreDeltas: SubScoreDelta[];
	citationCountBefore: number;
	citationCountAfter: number;
	citationDelta: number;
	citationDirection: ComparisonDirection;
}

/** Minimal snapshot shape required for comparison. */
export interface ComparableSnapshot {
	overallScore: number;
	readinessLevel: number;
	subScores: {
		readability: number | null;
		interactivity: number | null;
		transactional: number | null;
	};
	aiCitationCount: number;
}

// ── Helpers ──────────────────────────────────────────────────

function direction(delta: number): ComparisonDirection {
	if (delta > 0) return "improved";
	if (delta < 0) return "regressed";
	return "unchanged";
}

function nullableDirection(delta: number | null): ComparisonDirection {
	if (delta === null) return "unchanged";
	return direction(delta);
}

function nullableDelta(before: number | null, after: number | null): number | null {
	if (before === null || after === null) return null;
	return after - before;
}

// ── Main ─────────────────────────────────────────────────────

/**
 * Compute a comparison between snapshot A (before) and snapshot B (after).
 * All values are B - A, so positive means improvement.
 */
export function computeSnapshotComparison(
	snapshotA: ComparableSnapshot,
	snapshotB: ComparableSnapshot,
): SnapshotComparisonResult {
	const overallDelta = snapshotB.overallScore - snapshotA.overallScore;
	const overallPct =
		snapshotA.overallScore === 0
			? null
			: Math.round((overallDelta / snapshotA.overallScore) * 1000) / 10;

	const readinessLevelDelta = snapshotB.readinessLevel - snapshotA.readinessLevel;

	const categories = ["readability", "interactivity", "transactional"] as const;
	const subScoreDeltas: SubScoreDelta[] = categories.map((cat) => {
		const before = snapshotA.subScores[cat];
		const after = snapshotB.subScores[cat];
		const delta = nullableDelta(before, after);
		return {
			category: cat,
			before,
			after,
			delta,
			direction: nullableDirection(delta),
		};
	});

	const citationBefore = snapshotA.aiCitationCount ?? 0;
	const citationAfter = snapshotB.aiCitationCount ?? 0;
	const citationDelta = citationAfter - citationBefore;

	return {
		overallScoreDelta: overallDelta,
		overallPercentageChange: overallPct,
		overallDirection: direction(overallDelta),
		readinessLevelBefore: snapshotA.readinessLevel,
		readinessLevelAfter: snapshotB.readinessLevel,
		readinessLevelDelta,
		readinessDirection: direction(readinessLevelDelta),
		subScoreDeltas,
		citationCountBefore: citationBefore,
		citationCountAfter: citationAfter,
		citationDelta,
		citationDirection: direction(citationDelta),
	};
}
