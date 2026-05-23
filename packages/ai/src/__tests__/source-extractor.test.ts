import { describe, expect, it } from "vitest";
import { extractSources } from "../extraction/source-extractor.js";

describe("extractSources", () => {
	it("extracts URLs from markdown links", () => {
		const report = extractSources({
			responseText: "See [docs](https://example.com/a) for more.",
		});
		expect(report.sources).toHaveLength(1);
		expect(report.sources[0].url).toBe("https://example.com/a");
		expect(report.sources[0].sourceType).toBe("structured");
	});

	it("extracts URLs from footnote-style references", () => {
		const report = extractSources({
			responseText:
				"The feature is documented.\n\n[1]: https://example.com/docs\n[2]: https://example.com/faq",
		});
		const urls = report.sources.map((s) => s.url);
		expect(urls).toContain("https://example.com/docs");
		expect(urls).toContain("https://example.com/faq");
	});

	it("extracts URLs from angle-bracketed references", () => {
		const report = extractSources({
			responseText: "Check the docs: <https://example.com/page>",
		});
		expect(report.sources).toHaveLength(1);
		expect(report.sources[0].url).toBe("https://example.com/page");
	});

	it("merges provider-side citations that don't appear in text", () => {
		const report = extractSources({
			responseText: "Beacon optimizes AI visibility.",
			providerCitations: [
				{ url: "https://perplexity.ai/source-1", title: "Source 1" },
				{ url: "https://perplexity.ai/source-2" },
			],
		});
		expect(report.sources.map((s) => s.url)).toEqual([
			"https://perplexity.ai/source-1",
			"https://perplexity.ai/source-2",
		]);
	});

	it("deduplicates provider citations that also appear inline", () => {
		const report = extractSources({
			responseText: "See https://example.com/a for details.",
			providerCitations: [{ url: "https://example.com/a" }],
		});
		expect(report.sources).toHaveLength(1);
	});

	it("matches URLs against client pages and surfaces matchKind", () => {
		const report = extractSources({
			responseText: "See https://example.com/about for more.",
			clientPages: [{ clientPageId: "p1", url: "https://example.com/about" }],
		});
		expect(report.sources[0].matchedClientPageId).toBe("p1");
		expect(report.sources[0].matchKind).toBe("exact");
	});

	it("flags unstructured attribution when text says 'according to studies' but has no URLs", () => {
		const report = extractSources({
			responseText: "According to studies, Beacon boosts AI visibility significantly.",
		});
		expect(report.sources).toHaveLength(0);
		expect(report.hasUnstructuredAttribution).toBe(true);
	});

	it("does not flag unstructured attribution when URLs are present", () => {
		const report = extractSources({
			responseText: "According to studies <https://example.com/s>",
		});
		expect(report.hasUnstructuredAttribution).toBe(false);
		expect(report.sources).toHaveLength(1);
	});

	it("returns empty report for plain text with no citations", () => {
		const report = extractSources({ responseText: "Plain text without URLs." });
		expect(report.sources).toEqual([]);
		expect(report.hasUnstructuredAttribution).toBe(false);
	});

	it("handles mixed formats without double-counting", () => {
		const report = extractSources({
			responseText: "See [docs](https://example.com/a) and also <https://example.com/b>",
		});
		expect(report.sources.map((s) => s.url)).toEqual([
			"https://example.com/a",
			"https://example.com/b",
		]);
	});
});
