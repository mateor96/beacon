import { describe, expect, it } from "vitest";
import { exactMatchStrategy } from "../exact-match.strategy.js";
import { DEFAULT_EXTRACTION_OPTIONS } from "../types.js";
import {
	BRAND_GERMAN,
	BRAND_SHORT,
	BRAND_SPECIAL_CHARS,
	BRAND_VERY_SHORT,
	BRAND_WITH_VARIANTS,
	RESPONSE_CITATION,
	RESPONSE_COMPARISON,
	RESPONSE_NO_MENTIONS,
	RESPONSE_RECOMMENDATION,
	RESPONSE_WITH_URLS,
	SIMPLE_BRAND,
} from "./fixtures.js";

const opts = DEFAULT_EXTRACTION_OPTIONS;

describe("exactMatchStrategy", () => {
	it("finds exact case-insensitive match", () => {
		const matches = exactMatchStrategy.findMatches(
			"I recommend acme corp for this.",
			SIMPLE_BRAND,
			opts,
		);
		// Matches both "acme corp" (from "Acme Corp") and "acme" (from "Acme") primaryNames
		expect(matches.length).toBe(2);
		const fullMatch = matches.find((m) => m.matchedText === "acme corp");
		expect(fullMatch).toBeDefined();
		expect(fullMatch?.confidence).toBe(1.0);
		expect(fullMatch?.matchType).toBe("exact");
	});

	it("finds multi-word brand name", () => {
		const matches = exactMatchStrategy.findMatches(
			RESPONSE_RECOMMENDATION,
			BRAND_WITH_VARIANTS,
			opts,
		);
		const awsFullMatch = matches.find((m) => m.matchedText === "Amazon Web Services");
		expect(awsFullMatch).toBeDefined();
	});

	it("finds abbreviation as separate primary name", () => {
		const matches = exactMatchStrategy.findMatches(
			RESPONSE_RECOMMENDATION,
			BRAND_WITH_VARIANTS,
			opts,
		);
		const awsMatch = matches.find((m) => m.matchedText === "AWS");
		expect(awsMatch).toBeDefined();
	});

	it("respects word boundaries — no partial matches", () => {
		const matches = exactMatchStrategy.findMatches(
			"The Acmeville company is great.",
			SIMPLE_BRAND,
			opts,
		);
		expect(matches.length).toBe(0);
	});

	it("finds multiple occurrences", () => {
		const matches = exactMatchStrategy.findMatches(RESPONSE_COMPARISON, SIMPLE_BRAND, opts);
		expect(matches.length).toBeGreaterThanOrEqual(2);
	});

	it("handles special regex characters in brand name", () => {
		const matches = exactMatchStrategy.findMatches(RESPONSE_CITATION, BRAND_SPECIAL_CHARS, opts);
		const attMatches = matches.filter((m) => m.matchedText === "AT&T");
		expect(attMatches.length).toBeGreaterThanOrEqual(1);
	});

	it("skips matches inside URLs", () => {
		const matches = exactMatchStrategy.findMatches(RESPONSE_WITH_URLS, SIMPLE_BRAND, opts);
		// Should find "Acme Corp" in text but NOT "acme" inside https://acme.com/products
		const nonUrlMatches = matches.filter((m) => m.matchedText.toLowerCase().includes("acme corp"));
		expect(nonUrlMatches.length).toBe(1);
	});

	it("returns correct charOffset", () => {
		const text = "Hello Acme Corp world";
		const matches = exactMatchStrategy.findMatches(text, SIMPLE_BRAND, opts);
		const match = matches.find((m) => m.matchedText === "Acme Corp");
		expect(match).toBeDefined();
		expect(match?.charOffset).toBe(6);
		expect(match?.endOffset).toBe(15);
	});

	it("returns confidence 1.0 for all exact matches", () => {
		const matches = exactMatchStrategy.findMatches(RESPONSE_COMPARISON, SIMPLE_BRAND, opts);
		for (const m of matches) {
			expect(m.confidence).toBe(1.0);
		}
	});

	it("returns empty array for empty text", () => {
		const matches = exactMatchStrategy.findMatches("", SIMPLE_BRAND, opts);
		expect(matches).toEqual([]);
	});

	it("returns empty array when brand not in text", () => {
		const matches = exactMatchStrategy.findMatches(RESPONSE_NO_MENTIONS, SIMPLE_BRAND, opts);
		expect(matches).toEqual([]);
	});

	it("short brand name (2 chars) requires exact case", () => {
		const matches = exactMatchStrategy.findMatches(
			"AI is transforming industries. The ai revolution continues.",
			BRAND_VERY_SHORT,
			opts,
		);
		// Only "AI" (uppercase) should match, not "ai" (lowercase)
		expect(matches.length).toBe(1);
		expect(matches[0].matchedText).toBe("AI");
	});

	it("finds German brand names", () => {
		const matches = exactMatchStrategy.findMatches(
			"Die Deutsche Telekom bietet gute Tarife.",
			BRAND_GERMAN,
			opts,
		);
		expect(matches.length).toBeGreaterThanOrEqual(1);
	});
});
