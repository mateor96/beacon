import type { DbClient } from "@beacon/db";
import { competitiveQueries } from "@beacon/db";

export type TrendDirection = "improving" | "declining" | "stable";

/**
 * Threshold (fraction) required to classify a trend as improving/declining.
 * Env-overridable; default 5 % matches the issue spec.
 */
export function trendThreshold(): number {
	const raw = process.env.COMPETITIVE_TREND_THRESHOLD;
	if (!raw) return 0.05;
	const parsed = Number.parseFloat(raw);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0.05;
}

/**
 * Classify a trend from a series of recent scores (newest last).
 * Uses the first and last score in the provided window:
 *  - relative change > +threshold → improving
 *  - relative change < -threshold → declining
 *  - else → stable
 *
 * Returns "stable" when the series has fewer than 2 points.
 */
export function calculateTrend(scores: number[]): TrendDirection {
	const first = scores[0];
	const last = scores[scores.length - 1];
	if (first === undefined || last === undefined || scores.length < 2) return "stable";
	if (first === 0) {
		if (last > 0) return "improving";
		if (last < 0) return "declining";
		return "stable";
	}
	const change = (last - first) / Math.abs(first);
	const th = trendThreshold();
	if (change > th) return "improving";
	if (change < -th) return "declining";
	return "stable";
}

/**
 * Append a score history row and compute + store trend direction
 * based on the last 4 points (incl. the new one).
 */
export async function recordScore(
	db: DbClient,
	params: {
		domainKey: string;
		score: number;
		competitorId?: string | null;
		citationCount?: number;
	},
): Promise<{ trend: TrendDirection }> {
	const recent = await competitiveQueries.listHistoryForDomain(db, params.domainKey, {
		limit: 3,
	});
	// listHistoryForDomain returns newest first; series should be oldest → newest.
	const series = [...recent.map((r) => r.score).reverse(), params.score];
	const trend = calculateTrend(series);
	await competitiveQueries.appendScoreHistory(db, {
		competitorId: params.competitorId ?? null,
		domainKey: params.domainKey,
		score: params.score,
		citationCount: params.citationCount ?? 0,
		trend,
	});
	return { trend };
}

/**
 * Delete history rows older than 52 weeks. Wire as a weekly cron.
 */
export async function pruneOldHistory(db: DbClient): Promise<number> {
	const cutoff = new Date(Date.now() - 52 * 7 * 24 * 60 * 60 * 1000);
	const deleted = await competitiveQueries.pruneHistoryOlderThan(db, cutoff);
	return deleted.length;
}
