import { describe, expect, it } from "vitest";
import { contextualMatchStrategy } from "../contextual-match.strategy.js";
import { DEFAULT_EXTRACTION_OPTIONS } from "../types.js";
import { BRAND_SPECIAL_CHARS, BRAND_WITH_VARIANTS, SIMPLE_BRAND } from "./fixtures.js";

const opts = DEFAULT_EXTRACTION_OPTIONS;

describe("contextualMatchStrategy", () => {
	it("matches brand domain in URL", () => {
		const matches = contextualMatchStrategy.findMatches(
			"Visit https://acme.com/products for details.",
			SIMPLE_BRAND,
			opts,
		);
		expect(matches.length).toBe(1);
		expect(matches[0].matchType).toBe("contextual");
		expect(matches[0].confidence).toBe(0.85);
	});

	it("matches domain with www prefix", () => {
		const matches = contextualMatchStrategy.findMatches(
			"Check https://www.acme.com for updates.",
			SIMPLE_BRAND,
			opts,
		);
		expect(matches.length).toBe(1);
	});

	it("matches subdomain URL", () => {
		const matches = contextualMatchStrategy.findMatches(
			"See https://aws.amazon.com/s3 for storage.",
			BRAND_WITH_VARIANTS,
			opts,
		);
		expect(matches.length).toBe(1);
	});

	it("returns empty when no URLs match brand domains", () => {
		const matches = contextualMatchStrategy.findMatches(
			"Visit https://example.com for details.",
			SIMPLE_BRAND,
			opts,
		);
		expect(matches).toEqual([]);
	});

	it("returns empty when brand has no domains", () => {
		const brandNoDomain = { canonicalName: "Test", primaryNames: ["Test"], domains: [] };
		const matches = contextualMatchStrategy.findMatches(
			"Visit https://test.com for details.",
			brandNoDomain,
			opts,
		);
		expect(matches).toEqual([]);
	});

	it("returns empty for text without URLs", () => {
		const matches = contextualMatchStrategy.findMatches(
			"Acme Corp is a great company.",
			SIMPLE_BRAND,
			opts,
		);
		expect(matches).toEqual([]);
	});

	it("finds multiple URLs matching the same domain", () => {
		const matches = contextualMatchStrategy.findMatches(
			"See https://acme.com/a and https://acme.com/b for details.",
			SIMPLE_BRAND,
			opts,
		);
		expect(matches.length).toBe(2);
	});

	it("does not match URL of different domain", () => {
		const matches = contextualMatchStrategy.findMatches(
			"See https://att.com/plans for details.",
			SIMPLE_BRAND,
			opts,
		);
		expect(matches).toEqual([]);
	});

	it("handles empty text", () => {
		const matches = contextualMatchStrategy.findMatches("", SIMPLE_BRAND, opts);
		expect(matches).toEqual([]);
	});

	it("returns correct charOffset for URL match", () => {
		const text = "Go to https://acme.com/help now.";
		const matches = contextualMatchStrategy.findMatches(text, SIMPLE_BRAND, opts);
		expect(matches.length).toBe(1);
		expect(matches[0].charOffset).toBe(6);
	});
});
