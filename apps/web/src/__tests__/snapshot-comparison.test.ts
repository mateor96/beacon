import { computeSnapshotComparison } from "@beacon/shared";
import type { ComparableSnapshot } from "@beacon/shared";
import { describe, expect, it } from "vitest";

function makeSnapshot(overrides: Partial<ComparableSnapshot> = {}): ComparableSnapshot {
	return {
		overallScore: 50,
		readinessLevel: 1,
		subScores: { readability: 60, interactivity: 40, transactional: 30 },
		aiCitationCount: 5,
		...overrides,
	};
}

describe("computeSnapshotComparison", () => {
	it("computes positive deltas when B improves over A", () => {
		const a = makeSnapshot({ overallScore: 35, readinessLevel: 1, aiCitationCount: 2 });
		const b = makeSnapshot({
			overallScore: 72,
			readinessLevel: 2,
			subScores: { readability: 80, interactivity: 60, transactional: 50 },
			aiCitationCount: 8,
		});

		const result = computeSnapshotComparison(a, b);

		expect(result.overallScoreDelta).toBe(37);
		expect(result.overallDirection).toBe("improved");
		expect(result.overallPercentageChange).toBeCloseTo(105.7, 1);
		expect(result.readinessLevelDelta).toBe(1);
		expect(result.readinessDirection).toBe("improved");
		expect(result.citationDelta).toBe(6);
		expect(result.citationDirection).toBe("improved");

		const readability = result.subScoreDeltas.find((s) => s.category === "readability");
		expect(readability?.delta).toBe(20);
		expect(readability?.direction).toBe("improved");
	});

	it("computes negative deltas when B regresses from A", () => {
		const a = makeSnapshot({ overallScore: 80, readinessLevel: 3, aiCitationCount: 10 });
		const b = makeSnapshot({ overallScore: 60, readinessLevel: 2, aiCitationCount: 7 });

		const result = computeSnapshotComparison(a, b);

		expect(result.overallScoreDelta).toBe(-20);
		expect(result.overallDirection).toBe("regressed");
		expect(result.readinessDirection).toBe("regressed");
		expect(result.citationDelta).toBe(-3);
		expect(result.citationDirection).toBe("regressed");
	});

	it("reports unchanged when A and B are identical", () => {
		const a = makeSnapshot();
		const b = makeSnapshot();

		const result = computeSnapshotComparison(a, b);

		expect(result.overallScoreDelta).toBe(0);
		expect(result.overallDirection).toBe("unchanged");
		expect(result.readinessDirection).toBe("unchanged");
		expect(result.citationDirection).toBe("unchanged");

		for (const sub of result.subScoreDeltas) {
			expect(sub.delta).toBe(0);
			expect(sub.direction).toBe("unchanged");
		}
	});

	it("handles null sub-scores gracefully", () => {
		const a = makeSnapshot({
			subScores: { readability: null, interactivity: 40, transactional: null },
		});
		const b = makeSnapshot({
			subScores: { readability: 70, interactivity: null, transactional: null },
		});

		const result = computeSnapshotComparison(a, b);

		const readability = result.subScoreDeltas.find((s) => s.category === "readability");
		expect(readability?.delta).toBeNull();
		expect(readability?.direction).toBe("unchanged");

		const interactivity = result.subScoreDeltas.find((s) => s.category === "interactivity");
		expect(interactivity?.delta).toBeNull();
		expect(interactivity?.direction).toBe("unchanged");

		const transactional = result.subScoreDeltas.find((s) => s.category === "transactional");
		expect(transactional?.delta).toBeNull();
		expect(transactional?.direction).toBe("unchanged");
	});
});
