import { randomUUID } from "node:crypto";
import type {
	CheckId,
	DeltaDirection,
	ScanResult,
	ScoreSnapshot,
	SnapshotCheckDelta,
	SnapshotDelta,
	SnapshotType,
} from "@beacon/shared";
import { calculateScoreBreakdown } from "./scoring.js";

// ── Helpers (not exported) ──────────────────────────────────

function calcPercentageChange(before: number, after: number): number | null {
	if (before === 0) return null;
	return Math.round(((after - before) / before) * 10000) / 100;
}

function deltaDirection(delta: number): DeltaDirection {
	if (delta > 0) return "improved";
	if (delta < 0) return "regressed";
	return "unchanged";
}

// ── Public API ──────────────────────────────────────────────

/**
 * Capture a score snapshot from a completed scan result.
 * Pure transform: ScanResult → ScoreSnapshot. No DB interaction.
 */
export function captureSnapshot(
	scanResult: ScanResult,
	domainId: string,
	type: SnapshotType,
): ScoreSnapshot {
	const scores = calculateScoreBreakdown(scanResult.checks);
	return {
		id: randomUUID(),
		domainId,
		scanId: scanResult.id,
		type,
		scores,
		capturedAt: new Date().toISOString(),
		version: 1,
	};
}

/**
 * Compare two snapshots and compute structured deltas.
 * Handles missing checks, null level scores, and division-by-zero.
 */
export function compareSnapshots(before: ScoreSnapshot, after: ScoreSnapshot): SnapshotDelta {
	const overallDelta = after.scores.overallScore - before.scores.overallScore;

	// Build check maps
	const beforeMap = new Map(before.scores.checks.map((c) => [c.checkId, c.score]));
	const afterMap = new Map(after.scores.checks.map((c) => [c.checkId, c.score]));
	const allCheckIds = new Set([...beforeMap.keys(), ...afterMap.keys()]);

	const checkDeltas: SnapshotCheckDelta[] = [];
	const addedChecks: CheckId[] = [];
	const removedChecks: CheckId[] = [];

	for (const checkId of allCheckIds) {
		const bScore = beforeMap.get(checkId);
		const aScore = afterMap.get(checkId);
		const hasBefore = bScore !== undefined;
		const hasAfter = aScore !== undefined;

		if (hasBefore && hasAfter) {
			const delta = aScore - bScore;
			checkDeltas.push({
				checkId,
				before: bScore,
				after: aScore,
				delta,
				percentageChange: calcPercentageChange(bScore, aScore),
				direction: deltaDirection(delta),
			});
		} else if (!hasBefore && hasAfter) {
			addedChecks.push(checkId);
		} else if (hasBefore && !hasAfter) {
			removedChecks.push(checkId);
		}
	}

	// Level score deltas
	const levelScoreDeltas = {
		readability: calcLevelDelta(
			before.scores.levelScores.readability,
			after.scores.levelScores.readability,
		),
		interactivity: calcLevelDelta(
			before.scores.levelScores.interactivity,
			after.scores.levelScores.interactivity,
		),
		transactional: calcLevelDelta(
			before.scores.levelScores.transactional,
			after.scores.levelScores.transactional,
		),
	};

	return {
		beforeSnapshotId: before.id,
		afterSnapshotId: after.id,
		overallDelta,
		overallPercentageChange: calcPercentageChange(
			before.scores.overallScore,
			after.scores.overallScore,
		),
		readinessLevelDelta: after.scores.readinessLevel - before.scores.readinessLevel,
		levelScoreDeltas,
		checkDeltas,
		currentReadinessDelta:
			(after.scores.currentReadiness ?? 0) - (before.scores.currentReadiness ?? 0),
		futureReadinessDelta:
			(after.scores.futureReadiness ?? 0) - (before.scores.futureReadiness ?? 0),
		addedChecks,
		removedChecks,
		direction: deltaDirection(overallDelta),
	};
}

function calcLevelDelta(before: number | null, after: number | null): number | null {
	if (before === null && after === null) return null;
	return (after ?? 0) - (before ?? 0);
}
