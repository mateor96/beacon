import type {
	AggregatedRankingDeltas,
	DailyRankBucket,
	EngineRankingDelta,
	RankingDelta,
} from "./types.js";

/**
 * Computes ranking deltas (1d, 7d, 30d) from daily bucketed data.
 * Negative delta = improved (rank went down = better).
 * Null delta = missing comparison data.
 */
export function computeRankingDelta(
	buckets: DailyRankBucket[],
	referenceDate: string,
): RankingDelta {
	const byDate = new Map(buckets.map((b) => [b.date, b.avgRank]));

	const current = byDate.get(referenceDate) ?? null;

	if (current === null) {
		return { currentRank: null, delta1d: null, delta7d: null, delta30d: null };
	}

	const d1 = shiftDate(referenceDate, -1);
	const d7 = shiftDate(referenceDate, -7);
	const d30 = shiftDate(referenceDate, -30);

	const prev1 = byDate.get(d1) ?? null;
	const prev7 = byDate.get(d7) ?? null;
	const prev30 = byDate.get(d30) ?? null;

	return {
		currentRank: current,
		delta1d: prev1 !== null ? current - prev1 : null,
		delta7d: prev7 !== null ? current - prev7 : null,
		delta30d: prev30 !== null ? current - prev30 : null,
	};
}

/**
 * Computes aggregated ranking deltas across multiple engines.
 * Uses equal-weight average for v1.
 */
export function computeAggregatedDeltas(
	engineData: Array<{ aiEngine: string; buckets: DailyRankBucket[] }>,
	referenceDate: string,
): AggregatedRankingDeltas {
	const perEngine: EngineRankingDelta[] = engineData.map((ed) => ({
		aiEngine: ed.aiEngine,
		current: computeRankingDelta(ed.buckets, referenceDate),
	}));

	// Aggregated = equal-weight average across engines that have current data
	const withData = perEngine.filter((e) => e.current.currentRank !== null);

	if (withData.length === 0) {
		return {
			aggregated: { currentRank: null, delta1d: null, delta7d: null, delta30d: null },
			perEngine,
		};
	}

	const avgCurrent = avg(
		withData.flatMap((e) => (e.current.currentRank === null ? [] : [e.current.currentRank])),
	);
	const avgDelta1d = avgNullable(withData.map((e) => e.current.delta1d));
	const avgDelta7d = avgNullable(withData.map((e) => e.current.delta7d));
	const avgDelta30d = avgNullable(withData.map((e) => e.current.delta30d));

	return {
		aggregated: {
			currentRank: round1(avgCurrent),
			delta1d: avgDelta1d !== null ? round1(avgDelta1d) : null,
			delta7d: avgDelta7d !== null ? round1(avgDelta7d) : null,
			delta30d: avgDelta30d !== null ? round1(avgDelta30d) : null,
		},
		perEngine,
	};
}

// ── Helpers ─────────────────────────────────────────────────

function shiftDate(isoDate: string, days: number): string {
	const d = new Date(isoDate);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

function avg(nums: number[]): number {
	return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function avgNullable(nums: Array<number | null>): number | null {
	const valid = nums.filter((n): n is number => n !== null);
	return valid.length > 0 ? avg(valid) : null;
}

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}
