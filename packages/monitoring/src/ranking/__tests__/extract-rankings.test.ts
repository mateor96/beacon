import { describe, expect, it } from "vitest";
import { extractRankings } from "../extract-rankings.js";
import {
	BRAND_ACME,
	COMPETITORS,
	RESPONSE_BRAND_ONLY,
	RESPONSE_BULLET_LIST,
	RESPONSE_EMPTY,
	RESPONSE_GERMAN_LIST,
	RESPONSE_MIXED,
	RESPONSE_NO_BRAND,
	RESPONSE_NO_LIST,
	RESPONSE_NUMBERED_LIST,
	RESPONSE_PROSE_ONLY,
	RESPONSE_TOP_N,
} from "./fixtures.js";

describe("extractRankings", () => {
	it("extracts brand position from numbered list", () => {
		const report = extractRankings(RESPONSE_NUMBERED_LIST, BRAND_ACME, COMPETITORS);
		const brand = report.rankings.find((r) => r.isTargetBrand);
		expect(brand).toBeDefined();
		expect(brand?.rankPosition).toBe(3);
		expect(brand?.rankSource).toBe("list");
		expect(brand?.confidence).toBe(0.9);
		expect(report.listDetected).toBe(true);
	});

	it("extracts competitors from numbered list", () => {
		const report = extractRankings(RESPONSE_NUMBERED_LIST, BRAND_ACME, COMPETITORS);
		const salesforce = report.rankings.find((r) => r.entityName === "Salesforce");
		expect(salesforce).toBeDefined();
		expect(salesforce?.rankPosition).toBe(1);
		expect(salesforce?.isTargetBrand).toBe(false);
	});

	it("extracts from bullet list", () => {
		const report = extractRankings(RESPONSE_BULLET_LIST, BRAND_ACME, COMPETITORS);
		const brand = report.rankings.find((r) => r.isTargetBrand);
		expect(brand).toBeDefined();
		expect(brand?.rankPosition).toBe(2);
		expect(brand?.confidence).toBe(0.8);
	});

	it("extracts from Top N list with high confidence", () => {
		const report = extractRankings(RESPONSE_TOP_N, BRAND_ACME, COMPETITORS);
		const brand = report.rankings.find((r) => r.isTargetBrand);
		expect(brand).toBeDefined();
		expect(brand?.rankPosition).toBe(2);
		expect(brand?.confidence).toBe(0.9);
	});

	it("falls back to mention-order for prose", () => {
		const report = extractRankings(RESPONSE_PROSE_ONLY, BRAND_ACME, COMPETITORS);
		const brand = report.rankings.find((r) => r.isTargetBrand);
		expect(brand).toBeDefined();
		expect(brand?.rankSource).toBe("mention-order");
		expect(brand?.confidence).toBe(0.6);
		expect(report.listDetected).toBe(false);
	});

	it("returns empty rankings when brand not found", () => {
		const report = extractRankings(RESPONSE_NO_BRAND, BRAND_ACME, COMPETITORS);
		expect(report.rankings.filter((r) => r.isTargetBrand)).toHaveLength(0);
		// Should have no rankings at all since brand is required
		expect(report.rankings).toHaveLength(0);
	});

	it("returns rank 1 for single brand mention", () => {
		const report = extractRankings(RESPONSE_BRAND_ONLY, BRAND_ACME, []);
		const brand = report.rankings.find((r) => r.isTargetBrand);
		expect(brand).toBeDefined();
		expect(brand?.rankPosition).toBe(1);
	});

	it("extracts from German-language list", () => {
		const report = extractRankings(RESPONSE_GERMAN_LIST, BRAND_ACME, COMPETITORS);
		const brand = report.rankings.find((r) => r.isTargetBrand);
		expect(brand).toBeDefined();
		expect(brand?.rankPosition).toBe(2);
	});

	it("prefers list over prose in mixed content", () => {
		const report = extractRankings(RESPONSE_MIXED, BRAND_ACME, COMPETITORS);
		const brand = report.rankings.find((r) => r.isTargetBrand);
		expect(brand).toBeDefined();
		expect(brand?.rankSource).toBe("list");
		expect(report.listDetected).toBe(true);
	});

	it("returns empty for empty text", () => {
		const report = extractRankings(RESPONSE_EMPTY, BRAND_ACME, COMPETITORS);
		expect(report.rankings).toHaveLength(0);
	});

	it("returns empty for no-list no-mention text", () => {
		const report = extractRankings(RESPONSE_NO_LIST, BRAND_ACME, []);
		expect(report.rankings).toHaveLength(0);
	});

	it("populates durationMs", () => {
		const report = extractRankings(RESPONSE_NUMBERED_LIST, BRAND_ACME, COMPETITORS);
		expect(report.durationMs).toBeGreaterThanOrEqual(0);
	});

	it("assigns correct total rankings count", () => {
		const report = extractRankings(RESPONSE_NUMBERED_LIST, BRAND_ACME, COMPETITORS);
		// Brand + competitors found in the list
		expect(report.rankings.length).toBeGreaterThanOrEqual(3);
	});

	it("uses provided mentions for fallback", () => {
		const mentions = [
			{
				brandName: "Acme Corp",
				mentionType: "passing" as const,
				position: 50,
				contextText: "",
				sentiment: "neutral" as const,
				matchType: "exact" as const,
				confidence: 1,
			},
		];
		const report = extractRankings(RESPONSE_BRAND_ONLY, BRAND_ACME, [], mentions);
		const brand = report.rankings.find((r) => r.isTargetBrand);
		expect(brand).toBeDefined();
		expect(brand?.rankPosition).toBe(1);
	});
});
