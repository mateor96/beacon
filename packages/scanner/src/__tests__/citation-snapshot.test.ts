import { describe, expect, it } from "vitest";
import { computeCitationDelta } from "../services/citation-snapshot.js";

describe("computeCitationDelta", () => {
	it("returns zero delta for identical snapshots", () => {
		const snap = {
			totalCitations: 5,
			modelBreakdown: { claude: 3, gpt: 2 },
			urls: ["https://a.com", "https://b.com"],
		};
		const delta = computeCitationDelta(snap, snap);
		expect(delta.totalChange).toBe(0);
		expect(delta.percentChange).toBe(0);
		expect(delta.newCitations).toEqual([]);
		expect(delta.lostCitations).toEqual([]);
	});

	it("computes positive delta and percent change when citations increase", () => {
		const before = { totalCitations: 10, modelBreakdown: { claude: 10 }, urls: ["a", "b"] };
		const after = {
			totalCitations: 15,
			modelBreakdown: { claude: 13, gpt: 2 },
			urls: ["a", "b", "c"],
		};
		const delta = computeCitationDelta(before, after);
		expect(delta.totalChange).toBe(5);
		expect(delta.percentChange).toBe(50);
		expect(delta.byModel.claude).toEqual({ before: 10, after: 13, change: 3 });
		expect(delta.byModel.gpt).toEqual({ before: 0, after: 2, change: 2 });
		expect(delta.newCitations).toEqual(["c"]);
		expect(delta.lostCitations).toEqual([]);
	});

	it("computes negative delta when citations decrease", () => {
		const before = { totalCitations: 8, modelBreakdown: { claude: 8 }, urls: ["a", "b"] };
		const after = { totalCitations: 5, modelBreakdown: { claude: 5 }, urls: ["a"] };
		const delta = computeCitationDelta(before, after);
		expect(delta.totalChange).toBe(-3);
		expect(delta.percentChange).toBe(-37);
		expect(delta.lostCitations).toEqual(["b"]);
		expect(delta.newCitations).toEqual([]);
	});

	it("caps percentChange at 100 when before is 0 and after is non-zero", () => {
		const before = { totalCitations: 0, modelBreakdown: {}, urls: [] };
		const after = { totalCitations: 4, modelBreakdown: { gpt: 4 }, urls: ["a"] };
		const delta = computeCitationDelta(before, after);
		expect(delta.percentChange).toBe(100);
	});

	it("percentChange is 0 when both sides are 0", () => {
		const empty = { totalCitations: 0, modelBreakdown: {}, urls: [] };
		const delta = computeCitationDelta(empty, empty);
		expect(delta.percentChange).toBe(0);
	});

	it("tracks models that only appear in one snapshot", () => {
		const before = { totalCitations: 3, modelBreakdown: { claude: 3 }, urls: [] };
		const after = { totalCitations: 4, modelBreakdown: { gpt: 4 }, urls: [] };
		const delta = computeCitationDelta(before, after);
		expect(delta.byModel.claude).toEqual({ before: 3, after: 0, change: -3 });
		expect(delta.byModel.gpt).toEqual({ before: 0, after: 4, change: 4 });
	});

	it("identifies newly-added and lost URLs by set difference", () => {
		const before = {
			totalCitations: 3,
			modelBreakdown: {},
			urls: ["https://a.com", "https://b.com", "https://c.com"],
		};
		const after = {
			totalCitations: 3,
			modelBreakdown: {},
			urls: ["https://b.com", "https://c.com", "https://d.com"],
		};
		const delta = computeCitationDelta(before, after);
		expect(delta.newCitations).toEqual(["https://d.com"]);
		expect(delta.lostCitations).toEqual(["https://a.com"]);
	});
});
