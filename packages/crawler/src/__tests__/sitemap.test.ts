import { describe, expect, it } from "vitest";
import { parseSitemap } from "../sitemap.js";

describe("parseSitemap", () => {
	it("extracts <loc> from a flat sitemap", () => {
		const xml = `
			<?xml version="1.0" encoding="UTF-8"?>
			<urlset>
				<url><loc>https://example.com/a</loc></url>
				<url><loc>https://example.com/b</loc></url>
			</urlset>
		`;
		const result = parseSitemap(xml);
		expect(result.urls).toEqual(["https://example.com/a", "https://example.com/b"]);
		expect(result.indexes).toEqual([]);
	});

	it("separates sitemap-index entries from URLs", () => {
		const xml = `
			<sitemapindex>
				<sitemap><loc>https://example.com/sitemap-0.xml</loc></sitemap>
				<sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap>
			</sitemapindex>
		`;
		const result = parseSitemap(xml);
		expect(result.indexes).toEqual([
			"https://example.com/sitemap-0.xml",
			"https://example.com/sitemap-1.xml",
		]);
		expect(result.urls).toEqual([]);
	});

	it("returns empty result for non-XML input", () => {
		const result = parseSitemap("not xml at all");
		expect(result.urls).toEqual([]);
		expect(result.indexes).toEqual([]);
	});
});
