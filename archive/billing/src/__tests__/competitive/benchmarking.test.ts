import { describe, expect, it } from "vitest";
import { calculateBenchmark } from "../../competitive/benchmarking.js";

describe("calculateBenchmark", () => {
	it("no competitors → null stats", () => {
		const r = calculateBenchmark({ readinessScore: 80 }, []);
		expect(r.competitorCount).toBe(0);
		expect(r.byDimension.readinessScore.rank).toBeNull();
		expect(r.byDimension.readinessScore.percentile).toBeNull();
		expect(r.byDimension.readinessScore.clientValue).toBe(80);
	});

	it("computes rank, percentile, avg, gap", () => {
		const r = calculateBenchmark({ readinessScore: 80 }, [
			{ id: "c1", readinessScore: 60 },
			{ id: "c2", readinessScore: 90 },
			{ id: "c3", readinessScore: 50 },
		]);
		const d = r.byDimension.readinessScore;
		expect(d.rank).toBe(2); // 90, 80, 60, 50 → client at index 1 → rank 2
		expect(d.percentile).toBe(67); // beats 2 of 3 competitors → 66.67 rounded to 67
		expect(d.avgCompetitor).toBeCloseTo(66.67, 1);
		expect(d.bestCompetitor).toBe(90);
		expect(d.worstCompetitor).toBe(50);
		expect(d.gapVsBest).toBe(-10);
	});

	it("client missing dimension → clientValue null but competitor stats populated", () => {
		const r = calculateBenchmark({}, [{ id: "c1", readinessScore: 60 }]);
		expect(r.byDimension.readinessScore.clientValue).toBeNull();
		expect(r.byDimension.readinessScore.rank).toBeNull();
		expect(r.byDimension.readinessScore.avgCompetitor).toBe(60);
	});

	it("client is the best → rank 1, percentile 100", () => {
		const r = calculateBenchmark({ readinessScore: 99 }, [{ id: "c1", readinessScore: 50 }]);
		expect(r.byDimension.readinessScore.rank).toBe(1);
		expect(r.byDimension.readinessScore.percentile).toBe(100);
		expect(r.byDimension.readinessScore.gapVsBest).toBe(49);
	});

	it("ignores competitors missing a given dimension", () => {
		const r = calculateBenchmark({ readinessScore: 80, jsonLdScore: 70 }, [
			{ id: "c1", readinessScore: 60, jsonLdScore: null },
			{ id: "c2", readinessScore: 90, jsonLdScore: 50 },
		]);
		expect(r.byDimension.readinessScore.avgCompetitor).toBe(75);
		expect(r.byDimension.jsonLdScore.avgCompetitor).toBe(50);
	});

	// #283 additions: edge cases surfacing during the test-suite review

	it("all tied scores: percentile = 0 (strictly-beats-nobody)", () => {
		const r = calculateBenchmark({ readinessScore: 75 }, [
			{ id: "c1", readinessScore: 75 },
			{ id: "c2", readinessScore: 75 },
		]);
		expect(r.byDimension.readinessScore.percentile).toBe(0);
		expect(r.byDimension.readinessScore.gapVsBest).toBe(0);
	});

	it("exactly 1 competitor, client wins: rank=1, percentile=100, gapVsBest>0", () => {
		const r = calculateBenchmark({ readinessScore: 90 }, [{ id: "c1", readinessScore: 60 }]);
		expect(r.byDimension.readinessScore.rank).toBe(1);
		expect(r.byDimension.readinessScore.percentile).toBe(100);
		expect(r.byDimension.readinessScore.gapVsBest).toBe(30);
	});

	it("percentile is always an integer 0-100", () => {
		const r = calculateBenchmark(
			{ readinessScore: 60 },
			Array.from({ length: 7 }, (_, i) => ({
				id: `c${i}`,
				readinessScore: i * 10,
			})),
		);
		const p = r.byDimension.readinessScore.percentile;
		expect(p).not.toBeNull();
		expect(p).toBeGreaterThanOrEqual(0);
		expect(p).toBeLessThanOrEqual(100);
		expect(Number.isInteger(p)).toBe(true);
	});

	it("all 5 dimensions always present in the output", () => {
		const r = calculateBenchmark({}, []);
		const keys = Object.keys(r.byDimension);
		expect(keys).toContain("readinessScore");
		expect(keys).toContain("jsonLdScore");
		expect(keys).toContain("llmsTxtScore");
		expect(keys).toContain("agentsMdScore");
		expect(keys).toContain("citationCount");
	});
});
