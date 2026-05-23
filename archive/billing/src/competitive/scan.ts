import type { DbClient } from "@beacon/db";
import { competitiveQueries, competitorQueries, scanQueries } from "@beacon/db";
import { addJob } from "@beacon/queue";

export const COMPETITOR_SCAN_JOB_PREFIX = "competitor:scan:";
export function competitorScanJobId(competitorId: string): string {
	return `${COMPETITOR_SCAN_JOB_PREFIX}${competitorId}`;
}

export interface EnqueueCompetitorScanParams {
	db: DbClient;
	competitorId: string;
	url: string;
	userId: string | null;
}

export type EnqueueCompetitorScanResult =
	| { status: "enqueued"; scanId: string; resultId: string }
	| { status: "competitor_not_found" }
	| { status: "no_domain" };

/**
 * Kick off a competitor scan. Allocates a `scans` row on the same domain
 * (reusing the full readiness pipeline), creates a competitor_scan_results
 * row to track the outcome, and enqueues the job with a competitor-scoped
 * jobId for idempotency across the configured scan frequency.
 *
 * The scan processor's post-completion hook (#189 + #205) copies the final
 * scores from scans → competitor_scan_results + appends to
 * competitor_score_history.
 */
export async function enqueueCompetitorScan(
	params: EnqueueCompetitorScanParams,
): Promise<EnqueueCompetitorScanResult> {
	const competitor = await competitorQueries.getById(params.db, params.competitorId);
	if (!competitor) return { status: "competitor_not_found" };

	const domain = competitor.domain ?? params.url;
	if (!domain) return { status: "no_domain" };

	const url = domain.startsWith("http") ? domain : `https://${domain}`;

	const scan = await scanQueries.create(params.db, {
		userId: params.userId,
		url,
		score: 0,
		readinessLevel: 0,
		levelScores: { readability: null, interactivity: null, transactional: null },
		checks: [],
		status: "pending",
	});

	const result = await competitiveQueries.createScanResult(params.db, {
		competitorId: params.competitorId,
		scanId: scan.id,
		status: "pending",
	});

	await addJob(
		"scan",
		{ scanId: scan.id, url },
		{ jobId: competitorScanJobId(params.competitorId), priority: 5 },
	);

	return { status: "enqueued", scanId: scan.id, resultId: result.id };
}
