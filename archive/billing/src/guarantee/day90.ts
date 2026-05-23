import type { DbClient } from "@beacon/db";
import { guaranteeQueries, scanQueries } from "@beacon/db";
import { addJob } from "@beacon/queue";

export const GUARANTEE_DAY90_JOB_PREFIX = "guarantee:day90:";
export function guaranteeDay90JobId(claimId: string): string {
	return `${GUARANTEE_DAY90_JOB_PREFIX}${claimId}`;
}

/**
 * Score-delta threshold above which we consider the guarantee "improved".
 * Configurable via GUARANTEE_COMPARISON_THRESHOLD (integer, default 0 meaning
 * any positive delta counts as an improvement).
 */
function comparisonThreshold(): number {
	const raw = process.env.GUARANTEE_COMPARISON_THRESHOLD;
	const parsed = raw ? Number.parseInt(raw, 10) : 0;
	return Number.isFinite(parsed) ? parsed : 0;
}

export interface Day90CronResult {
	checked: number;
	scheduled: number;
	skipped: number;
}

/**
 * Daily cron handler. Finds claims where startedAt + 90d has elapsed
 * and enqueues a fresh scan job whose completion (in scan.processor.ts)
 * updates the claim status to `improved` or `eligible_for_refund`.
 */
export async function runDay90ComparisonCron(db: DbClient): Promise<Day90CronResult> {
	const due = await guaranteeQueries.listDueForComparison(db, new Date());
	let scheduled = 0;
	let skipped = 0;

	for (const claim of due) {
		if (!claim.userId || !claim.baselineSnapshotId) {
			skipped++;
			continue;
		}
		const baseline = await scanQueries.getById(db, claim.baselineSnapshotId);
		if (!baseline || baseline.status !== "completed") {
			// Baseline scan never finished — nothing to compare against. Leave
			// the claim in `active`; ops can investigate.
			skipped++;
			continue;
		}

		const newScan = await scanQueries.create(db, {
			userId: claim.userId,
			url: baseline.url,
			score: 0,
			readinessLevel: 0,
			levelScores: {
				readability: null,
				interactivity: null,
				transactional: null,
			},
			checks: [],
			status: "pending",
		});

		await addJob(
			"scan",
			{ scanId: newScan.id, url: baseline.url },
			{ jobId: guaranteeDay90JobId(claim.id), priority: 1 },
		);
		scheduled++;
	}

	return { checked: due.length, scheduled, skipped };
}

/**
 * Called by the scan processor after a day-90 comparison scan completes.
 * Loads the claim + baseline, computes the delta, and transitions the
 * claim to `improved` or `eligible_for_refund`.
 */
export async function handleDay90ScanCompletion(
	db: DbClient,
	claimId: string,
	currentScore: number,
	currentScanId: string,
): Promise<{ decision: "improved" | "eligible_for_refund"; delta: number } | null> {
	const claim = await guaranteeQueries.getClaimById(db, claimId);
	if (!claim || claim.status !== "active" || !claim.baselineSnapshotId) return null;
	const baseline = await scanQueries.getById(db, claim.baselineSnapshotId);
	if (!baseline) return null;

	const delta = currentScore - baseline.score;
	const threshold = comparisonThreshold();
	const decision: "improved" | "eligible_for_refund" =
		delta > threshold ? "improved" : "eligible_for_refund";

	await guaranteeQueries.updateClaim(db, claim.id, { status: decision });
	await guaranteeQueries.createMilestone(db, {
		claimId: claim.id,
		milestoneDay: 90,
		scanId: currentScanId,
		baselineScore: baseline.score,
		currentScore,
		delta,
	});

	return { decision, delta };
}
