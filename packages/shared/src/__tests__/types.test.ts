import { describe, expect, it } from "vitest";
import { CHECK_IDS, FIX_GENERATOR_IDS, PLAN_NAMES } from "../types";

describe("CHECK_IDS", () => {
	it("has exactly 14 entries", () => {
		expect(CHECK_IDS).toHaveLength(14);
	});

	it("contains the correct values", () => {
		expect(CHECK_IDS).toEqual([
			"llms-txt",
			"robots-txt",
			"sitemap-xml",
			"schema-org",
			"content-structure",
			"performance",
			"meta-tags",
			"webmcp",
			"agents-md",
			"semantic-quality",
			"citation-readiness",
			"content-freshness",
			"faq-schema",
			"js-rendering",
		]);
	});
});

describe("FIX_GENERATOR_IDS", () => {
	it("has exactly 5 entries", () => {
		expect(FIX_GENERATOR_IDS).toHaveLength(5);
	});

	it("every entry is a valid CheckId", () => {
		for (const id of FIX_GENERATOR_IDS) {
			expect(CHECK_IDS).toContain(id);
		}
	});
});

describe("PLAN_NAMES", () => {
	it("has exactly 5 entries", () => {
		expect(PLAN_NAMES).toHaveLength(5);
	});

	it("contains the correct values", () => {
		expect(PLAN_NAMES).toEqual(["free", "starter", "pro", "agency", "enterprise"]);
	});
});
