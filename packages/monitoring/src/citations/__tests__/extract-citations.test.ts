import { describe, expect, it } from "vitest";
import { extractCitations } from "../extract-citations.js";
import { normalizeUrl } from "../normalize-url.js";

describe("normalizeUrl", () => {
	it("strips utm and fbclid tracking params", () => {
		const result = normalizeUrl(
			"https://example.com/page?utm_source=foo&id=123&fbclid=abc&utm_medium=x",
		);
		expect(result).not.toBeNull();
		expect(result?.url).toBe("https://example.com/page?id=123");
		expect(result?.domain).toBe("example.com");
	});

	it("removes fragment and lowercases host", () => {
		const result = normalizeUrl("https://EXAMPLE.com/x#section-1");
		expect(result?.url).toBe("https://example.com/x");
	});

	it("strips trailing slash on bare-host URLs", () => {
		const result = normalizeUrl("https://example.com/");
		expect(result?.url).toBe("https://example.com");
	});

	it("preserves non-tracking query params", () => {
		const result = normalizeUrl("https://example.com/search?q=llm&page=2");
		expect(result?.url).toBe("https://example.com/search?q=llm&page=2");
	});

	it("rejects non-http schemes", () => {
		expect(normalizeUrl("mailto:foo@bar.com")).toBeNull();
		expect(normalizeUrl("javascript:alert(1)")).toBeNull();
	});

	it("rejects unparseable strings", () => {
		expect(normalizeUrl("not a url")).toBeNull();
		expect(normalizeUrl("")).toBeNull();
	});
});

describe("extractCitations", () => {
	it("extracts markdown links with text", () => {
		const text = "See [the docs](https://example.com/docs) for details.";
		const results = extractCitations(text);
		expect(results).toHaveLength(1);
		expect(results[0].normalizedUrl).toBe("https://example.com/docs");
		expect(results[0].domain).toBe("example.com");
		expect(results[0].contextSnippet).toContain("the docs");
	});

	it("extracts bare inline URLs", () => {
		const text = "Check https://example.com/page for more info.";
		const results = extractCitations(text);
		expect(results).toHaveLength(1);
		expect(results[0].normalizedUrl).toBe("https://example.com/page");
	});

	it("strips trailing punctuation on bare URLs", () => {
		const text = "Visit https://example.com/page, it's great.";
		const results = extractCitations(text);
		expect(results[0].normalizedUrl).toBe("https://example.com/page");
	});

	it("does not double-count markdown and inline form of the same link", () => {
		const text = "See [docs](https://example.com/docs).";
		const results = extractCitations(text);
		expect(results).toHaveLength(1);
	});

	it("returns citations ordered by document position", () => {
		const text = "First https://a.com, then [second](https://b.com), then https://c.com.";
		const results = extractCitations(text);
		expect(results.map((r) => r.domain)).toEqual(["a.com", "b.com", "c.com"]);
	});

	it("normalizes URLs and exposes both raw and normalized forms", () => {
		const text = "Look at [this](https://example.com/p?utm_source=x&id=1)";
		const results = extractCitations(text);
		expect(results[0].rawUrl).toBe("https://example.com/p?utm_source=x&id=1");
		expect(results[0].normalizedUrl).toBe("https://example.com/p?id=1");
	});

	it("caps context snippet at 500 chars", () => {
		const padding = "x".repeat(600);
		const text = `${padding} https://example.com/p ${padding}`;
		const results = extractCitations(text);
		expect(results[0].contextSnippet.length).toBeLessThanOrEqual(500);
	});

	it("returns empty array for text with no URLs", () => {
		expect(extractCitations("Plain text with no links.")).toEqual([]);
	});

	it("skips invalid URLs silently", () => {
		const text = "Bad link [x](ftp://not-http.com) but ok https://example.com/good";
		const results = extractCitations(text);
		expect(results).toHaveLength(1);
		expect(results[0].domain).toBe("example.com");
	});
});
