import { describe, expect, it } from "vitest";
import { computeAggregatedDeltas, computeRankingDelta } from "../compute-deltas.js";
import type { DailyRankBucket } from "../types.js";

function makeBucket(date: string, avgRank: number): DailyRankBucket {
	return { date, avgRank, dataPoints: 1 };
}

describe("computeRankingDelta", () => {
	it("computes delta vs yesterday", () => {
		const buckets = [makeBucket("2026-04-05", 3), makeBucket("2026-04-04", 5)];
		const delta = computeRankingDelta(buckets, "2026-04-05");
		expect(delta.currentRank).toBe(3);
		expect(delta.delta1d).toBe(-2); // improved: 3 - 5 = -2
	});

	it("computes delta vs last week", () => {
		const buckets = [makeBucket("2026-04-05", 2), makeBucket("2026-03-29", 4)];
		const delta = computeRankingDelta(buckets, "2026-04-05");
		expect(delta.delta7d).toBe(-2);
	});

	it("computes delta vs last month", () => {
		const buckets = [makeBucket("2026-04-05", 1), makeBucket("2026-03-06", 3)];
		const delta = computeRankingDelta(buckets, "2026-04-05");
		expect(delta.delta30d).toBe(-2);
	});

	it("returns null deltas when no previous data", () => {
		const buckets = [makeBucket("2026-04-05", 3)];
		const delta = computeRankingDelta(buckets, "2026-04-05");
		expect(delta.currentRank).toBe(3);
		expect(delta.delta1d).toBeNull();
		expect(delta.delta7d).toBeNull();
		expect(delta.delta30d).toBeNull();
	});

	it("returns null currentRank when reference date has no data", () => {
		const buckets = [makeBucket("2026-04-04", 3)];
		const delta = computeRankingDelta(buckets, "2026-04-05");
		expect(delta.currentRank).toBeNull();
		expect(delta.delta1d).toBeNull();
	});

	it("handles empty buckets", () => {
		const delta = computeRankingDelta([], "2026-04-05");
		expect(delta.currentRank).toBeNull();
	});

	it("positive delta means rank regressed (worse)", () => {
		const buckets = [makeBucket("2026-04-05", 5), makeBucket("2026-04-04", 2)];
		const delta = computeRankingDelta(buckets, "2026-04-05");
		expect(delta.delta1d).toBe(3); // regressed: 5 - 2 = 3
	});

	it("zero delta means unchanged", () => {
		const buckets = [makeBucket("2026-04-05", 3), makeBucket("2026-04-04", 3)];
		const delta = computeRankingDelta(buckets, "2026-04-05");
		expect(delta.delta1d).toBe(0);
	});
});

describe("computeAggregatedDeltas", () => {
	it("aggregates across engines with equal weight", () => {
		const engineData = [
			{ aiEngine: "chatgpt", buckets: [makeBucket("2026-04-05", 2), makeBucket("2026-04-04", 4)] },
			{ aiEngine: "gemini", buckets: [makeBucket("2026-04-05", 4), makeBucket("2026-04-04", 6)] },
		];
		const result = computeAggregatedDeltas(engineData, "2026-04-05");
		expect(result.aggregated.currentRank).toBe(3); // avg(2, 4) = 3
		expect(result.aggregated.delta1d).toBe(-2); // avg(-2, -2) = -2
		expect(result.perEngine.length).toBe(2);
	});

	it("excludes engines without current data from aggregate", () => {
		const engineData = [
			{ aiEngine: "chatgpt", buckets: [makeBucket("2026-04-05", 2)] },
			{ aiEngine: "gemini", buckets: [] }, // no data
		];
		const result = computeAggregatedDeltas(engineData, "2026-04-05");
		expect(result.aggregated.currentRank).toBe(2); // only chatgpt has data
	});

	it("returns null aggregate when no engines have data", () => {
		const engineData = [{ aiEngine: "chatgpt", buckets: [] }];
		const result = computeAggregatedDeltas(engineData, "2026-04-05");
		expect(result.aggregated.currentRank).toBeNull();
	});

	it("includes per-engine breakdown", () => {
		const engineData = [
			{ aiEngine: "chatgpt", buckets: [makeBucket("2026-04-05", 1)] },
			{ aiEngine: "perplexity", buckets: [makeBucket("2026-04-05", 3)] },
		];
		const result = computeAggregatedDeltas(engineData, "2026-04-05");
		expect(result.perEngine.find((e) => e.aiEngine === "chatgpt")?.current.currentRank).toBe(1);
		expect(result.perEngine.find((e) => e.aiEngine === "perplexity")?.current.currentRank).toBe(3);
	});
});
