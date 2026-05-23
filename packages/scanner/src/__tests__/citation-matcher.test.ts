import { describe, expect, it } from "vitest";
import { levenshtein, matchCitationToClientPage } from "../services/citation-matcher.js";

describe("levenshtein", () => {
	it("returns 0 for identical strings", () => {
		expect(levenshtein("abc", "abc")).toBe(0);
	});

	it("counts insertion/deletion/substitution edits", () => {
		expect(levenshtein("abc", "abcd")).toBe(1);
		expect(levenshtein("abcd", "abc")).toBe(1);
		expect(levenshtein("abc", "abd")).toBe(1);
	});

	it("returns maxDistance+1 early when length difference exceeds cap", () => {
		expect(levenshtein("abc", "a".repeat(50), 3)).toBe(4);
	});

	it("caps at maxDistance+1 without computing full distance", () => {
		expect(levenshtein("abcdefghij", "zzzzzzzzzz", 2)).toBe(3);
	});
});

describe("matchCitationToClientPage", () => {
	const candidates = [
		{ clientPageId: "p1", url: "https://example.com/about" },
		{ clientPageId: "p2", url: "https://example.com/blog/post-1" },
		{ clientPageId: "p3", url: "https://other.com/x" },
	];

	it("returns exact match with confidence 100 for identical URLs", () => {
		const result = matchCitationToClientPage({
			citationUrl: "https://example.com/about",
			candidates,
		});
		expect(result).toEqual({ clientPageId: "p1", matchType: "exact", confidence: 100 });
	});

	it("matches path-based on same host/path despite www vs non-www", () => {
		const result = matchCitationToClientPage({
			citationUrl: "https://www.example.com/blog/post-1",
			candidates,
		});
		expect(result.matchType).toBe("path");
		expect(result.clientPageId).toBe("p2");
		expect(result.confidence).toBe(80);
	});

	it("matches path-based despite trailing slash difference", () => {
		const result = matchCitationToClientPage({
			citationUrl: "https://example.com/about/",
			candidates,
		});
		expect(result.matchType).toBe("path");
		expect(result.clientPageId).toBe("p1");
	});

	it("matches path-based across http vs https", () => {
		const result = matchCitationToClientPage({
			citationUrl: "http://example.com/about",
			candidates,
		});
		expect(result.matchType).toBe("path");
	});

	it("returns fuzzy match for small Levenshtein distance on path", () => {
		const result = matchCitationToClientPage({
			citationUrl: "https://example.com/abot",
			candidates,
		});
		expect(result.matchType).toBe("fuzzy");
		expect(result.clientPageId).toBe("p1");
		expect(result.confidence).toBeGreaterThanOrEqual(50);
		expect(result.confidence).toBeLessThanOrEqual(70);
	});

	it("returns unmatched when nothing fits within fuzzy threshold", () => {
		const result = matchCitationToClientPage({
			citationUrl: "https://example.com/completely-different-long-page",
			candidates,
		});
		expect(result).toEqual({ clientPageId: null, matchType: "unmatched", confidence: 0 });
	});

	it("does not cross-match across hosts even if paths are similar", () => {
		const result = matchCitationToClientPage({
			citationUrl: "https://unknown.com/about",
			candidates,
		});
		expect(result.matchType).toBe("unmatched");
	});

	it("short-circuits to manual when the URL is in the alias map", () => {
		const aliases = new Map([["https://random.com/x", "p1"]]);
		const result = matchCitationToClientPage({
			citationUrl: "https://random.com/x",
			candidates,
			manualAliases: aliases,
		});
		expect(result).toEqual({ clientPageId: "p1", matchType: "manual", confidence: 100 });
	});

	it("returns unmatched for invalid URLs", () => {
		const result = matchCitationToClientPage({
			citationUrl: "not a url",
			candidates,
		});
		expect(result.matchType).toBe("unmatched");
	});

	it("respects custom fuzzyMaxDistance", () => {
		const strict = matchCitationToClientPage({
			citationUrl: "https://example.com/abot",
			candidates,
			fuzzyMaxDistance: 0,
		});
		expect(strict.matchType).toBe("unmatched");
	});

	it("prefers path match over fuzzy match when both are possible", () => {
		const multi = [
			{ clientPageId: "exactish", url: "https://example.com/abot" },
			{ clientPageId: "path", url: "https://example.com/about" },
		];
		const result = matchCitationToClientPage({
			citationUrl: "https://example.com/about",
			candidates: multi,
		});
		expect(result).toEqual({ clientPageId: "path", matchType: "exact", confidence: 100 });
	});
});
