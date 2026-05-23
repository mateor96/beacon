import { describe, expect, it } from "vitest";
import {
	fuzzyMatchStrategy,
	jaroWinklerSimilarity,
	levenshteinDistance,
} from "../fuzzy-match.strategy.js";
import { DEFAULT_EXTRACTION_OPTIONS } from "../types.js";
import { BRAND_SHORT, BRAND_VERY_SHORT, BRAND_WITH_VARIANTS, SIMPLE_BRAND } from "./fixtures.js";

const opts = DEFAULT_EXTRACTION_OPTIONS;

describe("jaroWinklerSimilarity", () => {
	it("returns 1.0 for identical strings", () => {
		expect(jaroWinklerSimilarity("hello", "hello")).toBe(1.0);
	});

	it("returns 0.0 for completely different strings", () => {
		expect(jaroWinklerSimilarity("abc", "xyz")).toBe(0.0);
	});

	it("returns high similarity for typos", () => {
		const sim = jaroWinklerSimilarity("amazon", "amazn");
		expect(sim).toBeGreaterThan(0.9);
	});

	it("returns moderate similarity for transpositions", () => {
		const sim = jaroWinklerSimilarity("amazon", "amzaon");
		expect(sim).toBeGreaterThan(0.85);
	});
});

describe("levenshteinDistance", () => {
	it("returns 0 for identical strings", () => {
		expect(levenshteinDistance("hello", "hello")).toBe(0);
	});

	it("returns correct distance for single char difference", () => {
		expect(levenshteinDistance("amazon", "amazn")).toBe(1);
	});

	it("returns string length for empty comparison", () => {
		expect(levenshteinDistance("hello", "")).toBe(5);
		expect(levenshteinDistance("", "hello")).toBe(5);
	});

	it("returns correct distance for transposition", () => {
		expect(levenshteinDistance("amazon", "amzaon")).toBe(2);
	});
});

describe("fuzzyMatchStrategy", () => {
	it("finds single-char typo", () => {
		const matches = fuzzyMatchStrategy.findMatches(
			"I use Amazn Web Services daily.",
			BRAND_WITH_VARIANTS,
			opts,
		);
		expect(matches.length).toBeGreaterThanOrEqual(1);
		expect(matches[0].matchType).toBe("fuzzy");
	});

	it("does not match exact strings (handled by exact strategy)", () => {
		const matches = fuzzyMatchStrategy.findMatches(
			"Amazon Web Services is great.",
			BRAND_WITH_VARIANTS,
			opts,
		);
		// "Amazon" exact should be skipped by fuzzy strategy
		const exactAmazon = matches.filter((m) => m.matchedText.toLowerCase() === "amazon");
		expect(exactAmazon.length).toBe(0);
	});

	it("skips fuzzy matching for 2-char brands", () => {
		const matches = fuzzyMatchStrategy.findMatches(
			"The AI and AJ technologies are growing.",
			BRAND_VERY_SHORT,
			opts,
		);
		expect(matches.length).toBe(0);
	});

	it("uses Levenshtein-only for 3-char brands", () => {
		const matches = fuzzyMatchStrategy.findMatches(
			"The SBP system is reliable.",
			BRAND_SHORT,
			opts,
		);
		// "SBP" has Levenshtein distance 1 from "SAP"
		expect(matches.length).toBeGreaterThanOrEqual(1);
	});

	it("respects threshold — rejects distant matches", () => {
		const matches = fuzzyMatchStrategy.findMatches(
			"The Xylophone company is great.",
			SIMPLE_BRAND,
			opts,
		);
		expect(matches.length).toBe(0);
	});

	it("skips tokens inside URLs", () => {
		const matches = fuzzyMatchStrategy.findMatches(
			"Visit https://acm.com for details about Acm Corp.",
			SIMPLE_BRAND,
			opts,
		);
		// Only the non-URL "Acm" should potentially match, not the one in the URL
		const urlMatches = matches.filter((m) => m.charOffset < 30);
		expect(urlMatches.length).toBe(0);
	});

	it("length pre-filter eliminates distant lengths", () => {
		const matches = fuzzyMatchStrategy.findMatches("The Ac tool is nice.", SIMPLE_BRAND, opts);
		// "Ac" is too short compared to "Acme" (length diff > 2)
		expect(matches.length).toBe(0);
	});

	it("confidence reflects similarity score", () => {
		const matches = fuzzyMatchStrategy.findMatches(
			"I recommend Amazn for cloud.",
			BRAND_WITH_VARIANTS,
			opts,
		);
		if (matches.length > 0) {
			expect(matches[0].confidence).toBeGreaterThan(0);
			expect(matches[0].confidence).toBeLessThanOrEqual(0.9);
		}
	});

	it("returns empty for no fuzzy matches", () => {
		const matches = fuzzyMatchStrategy.findMatches(
			"The weather is nice today.",
			SIMPLE_BRAND,
			opts,
		);
		expect(matches).toEqual([]);
	});

	it("handles multi-word brand fuzzy match via n-grams", () => {
		const matches = fuzzyMatchStrategy.findMatches(
			"I use Amazn Web Servces for hosting.",
			BRAND_WITH_VARIANTS,
			opts,
		);
		// Should find n-gram fuzzy match for "Amazon Web Services"
		expect(matches.length).toBeGreaterThanOrEqual(1);
	});

	it("handles empty text", () => {
		const matches = fuzzyMatchStrategy.findMatches("", SIMPLE_BRAND, opts);
		expect(matches).toEqual([]);
	});
});
