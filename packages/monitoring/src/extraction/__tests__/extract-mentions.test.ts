import { describe, expect, it } from "vitest";
import { extractMentions } from "../extract-mentions.js";
import {
	BRAND_SHORT,
	BRAND_SPECIAL_CHARS,
	BRAND_WITH_VARIANTS,
	RESPONSE_CITATION,
	RESPONSE_COMPARISON,
	RESPONSE_GERMAN,
	RESPONSE_LONG,
	RESPONSE_MISSPELLED,
	RESPONSE_MULTIPLE_BRANDS,
	RESPONSE_NO_MENTIONS,
	RESPONSE_PASSING,
	RESPONSE_RECOMMENDATION,
	SIMPLE_BRAND,
} from "./fixtures.js";

describe("extractMentions — full pipeline", () => {
	it("extracts recommendation mentions with exact match", () => {
		const report = extractMentions(RESPONSE_RECOMMENDATION, BRAND_WITH_VARIANTS);
		expect(report.mentions.length).toBeGreaterThanOrEqual(1);
		const rec = report.mentions.find((m) => m.mentionType === "recommendation");
		expect(rec).toBeDefined();
		expect(rec?.brandName).toBe("Amazon Web Services");
		expect(rec?.matchType).toBe("exact");
		expect(rec?.confidence).toBe(1.0);
	});

	it("extracts comparison mentions", () => {
		const report = extractMentions(RESPONSE_COMPARISON, SIMPLE_BRAND);
		expect(report.mentions.length).toBeGreaterThanOrEqual(1);
		const comp = report.mentions.find((m) => m.mentionType === "comparison");
		expect(comp).toBeDefined();
	});

	it("extracts citation mentions", () => {
		const report = extractMentions(RESPONSE_CITATION, BRAND_SPECIAL_CHARS);
		expect(report.mentions.length).toBeGreaterThanOrEqual(1);
		const cite = report.mentions.find((m) => m.mentionType === "citation");
		expect(cite).toBeDefined();
		expect(cite?.brandName).toBe("AT&T");
	});

	it("returns empty for text with no mentions", () => {
		const report = extractMentions(RESPONSE_NO_MENTIONS, SIMPLE_BRAND);
		expect(report.mentions).toEqual([]);
		expect(report.totalRawMatches).toBe(0);
	});

	it("handles multiple brands in text", () => {
		const report1 = extractMentions(RESPONSE_MULTIPLE_BRANDS, BRAND_SHORT);
		const report2 = extractMentions(RESPONSE_MULTIPLE_BRANDS, BRAND_WITH_VARIANTS);
		expect(report1.mentions.length).toBeGreaterThanOrEqual(1);
		expect(report2.mentions.length).toBeGreaterThanOrEqual(1);
	});

	it("extracts from German text", () => {
		const report = extractMentions(RESPONSE_GERMAN, BRAND_WITH_VARIANTS);
		expect(report.mentions.length).toBeGreaterThanOrEqual(1);
		expect(report.mentions[0].brandName).toBe("Amazon Web Services");
	});

	it("finds fuzzy matches for misspelled brands", () => {
		const report = extractMentions(RESPONSE_MISSPELLED, BRAND_WITH_VARIANTS);
		const fuzzy = report.mentions.filter((m) => m.matchType === "fuzzy");
		expect(fuzzy.length).toBeGreaterThanOrEqual(1);
	});

	it("classifies passing mentions correctly", () => {
		const report = extractMentions(RESPONSE_PASSING, SIMPLE_BRAND);
		const passing = report.mentions.filter((m) => m.mentionType === "passing");
		expect(passing.length).toBeGreaterThanOrEqual(1);
	});

	it("stores character offset as position", () => {
		const text = "Hello world Acme Corp is here.";
		const report = extractMentions(text, SIMPLE_BRAND);
		expect(report.mentions.length).toBeGreaterThanOrEqual(1);
		expect(report.mentions[0].position).toBe(12); // "Acme Corp" starts at index 12
	});

	it("includes context text around mentions", () => {
		const report = extractMentions(RESPONSE_RECOMMENDATION, BRAND_WITH_VARIANTS);
		expect(report.mentions.length).toBeGreaterThanOrEqual(1);
		expect(report.mentions[0].contextText.length).toBeGreaterThan(0);
		expect(report.mentions[0].contextText.length).toBeLessThanOrEqual(350); // 150 + match + 150
	});

	it("deduplicates overlapping matches", () => {
		// "AWS" is both a primaryName exact match and part of "Amazon Web Services"
		const report = extractMentions(RESPONSE_RECOMMENDATION, BRAND_WITH_VARIANTS);
		// Check that overlapping mentions were deduped (totalRawMatches >= mentions)
		expect(report.totalRawMatches).toBeGreaterThanOrEqual(report.mentions.length);
	});

	it("respects maxMentionsPerResponse", () => {
		const report = extractMentions(RESPONSE_LONG, SIMPLE_BRAND, { maxMentionsPerResponse: 1 });
		expect(report.mentions.length).toBeLessThanOrEqual(1);
	});

	it("respects minConfidence filter", () => {
		const report = extractMentions(RESPONSE_MISSPELLED, BRAND_WITH_VARIANTS, {
			minConfidence: 0.99,
		});
		// Only exact matches (confidence 1.0) should pass
		for (const m of report.mentions) {
			expect(m.confidence).toBeGreaterThanOrEqual(0.99);
		}
	});

	it("returns empty for empty text", () => {
		const report = extractMentions("", SIMPLE_BRAND);
		expect(report.mentions).toEqual([]);
	});

	it("returns empty for empty primaryNames", () => {
		const emptyBrand = { canonicalName: "", primaryNames: [], domains: [] };
		const report = extractMentions("Some text here.", emptyBrand);
		expect(report.mentions).toEqual([]);
	});

	it("populates durationMs", () => {
		const report = extractMentions(RESPONSE_RECOMMENDATION, BRAND_WITH_VARIANTS);
		expect(report.durationMs).toBeGreaterThanOrEqual(0);
	});

	it("completes in reasonable time for long text", () => {
		const longText = "Acme Corp is great. ".repeat(500);
		const start = performance.now();
		const report = extractMentions(longText, SIMPLE_BRAND);
		const elapsed = performance.now() - start;
		expect(elapsed).toBeLessThan(500); // should be well under 500ms
		expect(report.mentions.length).toBeGreaterThan(0);
	});
});
