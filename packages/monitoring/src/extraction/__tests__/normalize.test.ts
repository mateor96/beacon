import { describe, expect, it } from "vitest";
import { computeRelativePosition, deduplicateMatches, extractContextWindow } from "../normalize.js";
import type { MatchResult } from "../types.js";

function makeMatch(overrides: Partial<MatchResult> = {}): MatchResult {
	return {
		matchedText: "Acme",
		matchType: "exact",
		charOffset: 0,
		endOffset: 4,
		confidence: 1.0,
		brandCanonicalName: "Acme Corp",
		...overrides,
	};
}

describe("deduplicateMatches", () => {
	it("merges overlapping matches within radius", () => {
		const matches = [
			makeMatch({ charOffset: 10, confidence: 1.0, matchType: "exact" }),
			makeMatch({ charOffset: 15, confidence: 0.8, matchType: "fuzzy" }),
		];
		const result = deduplicateMatches(matches, 20);
		expect(result.length).toBe(1);
		expect(result[0].confidence).toBe(1.0);
	});

	it("keeps higher confidence match", () => {
		const matches = [
			makeMatch({ charOffset: 10, confidence: 0.7, matchType: "fuzzy" }),
			makeMatch({ charOffset: 12, confidence: 0.9, matchType: "fuzzy" }),
		];
		const result = deduplicateMatches(matches, 20);
		expect(result.length).toBe(1);
		expect(result[0].confidence).toBe(0.9);
	});

	it("prefers exact over fuzzy on confidence tie", () => {
		const matches = [
			makeMatch({ charOffset: 10, confidence: 0.9, matchType: "fuzzy" }),
			makeMatch({ charOffset: 12, confidence: 0.9, matchType: "exact" }),
		];
		const result = deduplicateMatches(matches, 20);
		expect(result.length).toBe(1);
		expect(result[0].matchType).toBe("exact");
	});

	it("does not merge distant matches", () => {
		const matches = [makeMatch({ charOffset: 10 }), makeMatch({ charOffset: 100 })];
		const result = deduplicateMatches(matches, 20);
		expect(result.length).toBe(2);
	});

	it("does not merge different brands", () => {
		const matches = [
			makeMatch({ charOffset: 10, brandCanonicalName: "Brand A" }),
			makeMatch({ charOffset: 12, brandCanonicalName: "Brand B" }),
		];
		const result = deduplicateMatches(matches, 20);
		expect(result.length).toBe(2);
	});

	it("handles empty array", () => {
		expect(deduplicateMatches([], 20)).toEqual([]);
	});

	it("handles single match", () => {
		const matches = [makeMatch()];
		expect(deduplicateMatches(matches, 20).length).toBe(1);
	});
});

describe("extractContextWindow", () => {
	const text = "0123456789ABCDEFGHIJ0123456789";

	it("extracts correct window", () => {
		const ctx = extractContextWindow(text, 10, 4, 5);
		// slice(max(0, 10-5), min(30, 10+4+5)) = slice(5, 19)
		expect(ctx).toBe("56789ABCDEFGHI");
	});

	it("clamps at text start", () => {
		const ctx = extractContextWindow(text, 2, 3, 10);
		expect(ctx.startsWith("0")).toBe(true);
	});

	it("clamps at text end", () => {
		const ctx = extractContextWindow(text, 25, 3, 10);
		expect(ctx.endsWith("9")).toBe(true);
	});
});

describe("computeRelativePosition", () => {
	it("returns top for first third", () => {
		expect(computeRelativePosition(10, 100)).toBe("top");
	});

	it("returns middle for second third", () => {
		expect(computeRelativePosition(50, 100)).toBe("middle");
	});

	it("returns bottom for last third", () => {
		expect(computeRelativePosition(80, 100)).toBe("bottom");
	});

	it("returns top for zero-length text", () => {
		expect(computeRelativePosition(0, 0)).toBe("top");
	});
});
