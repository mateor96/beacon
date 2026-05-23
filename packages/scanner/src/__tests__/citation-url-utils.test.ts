import { describe, expect, it } from "vitest";
import {
	extractCitationUrls,
	normalizeUrl,
	resolveRelative,
} from "../services/citation-url-utils.js";

// ── extractCitationUrls ─────────────────────────────────────

describe("extractCitationUrls", () => {
	it("extracts an inline URL", () => {
		expect(extractCitationUrls("See https://example.com/a for info.")).toEqual([
			"https://example.com/a",
		]);
	});

	it("extracts a markdown link", () => {
		expect(extractCitationUrls("[docs](https://example.com/docs)")).toEqual([
			"https://example.com/docs",
		]);
	});

	it("extracts a numbered reference", () => {
		expect(
			extractCitationUrls("[1] https://example.com/post\n[2] https://example.com/other"),
		).toEqual(["https://example.com/post", "https://example.com/other"]);
	});

	it("extracts mixed markdown + inline + numbered formats", () => {
		const text = `See [the docs](https://example.com/docs) for more.

			You may also like https://example.com/post.

			[1] https://example.com/ref1
			[2] https://example.com/ref2`;
		const out = extractCitationUrls(text);
		expect(out).toContain("https://example.com/docs");
		expect(out).toContain("https://example.com/post");
		expect(out).toContain("https://example.com/ref1");
		expect(out).toContain("https://example.com/ref2");
	});

	it("dedupes repeat URLs", () => {
		expect(extractCitationUrls("https://example.com and https://example.com again")).toHaveLength(
			1,
		);
	});

	it("strips trailing punctuation", () => {
		expect(extractCitationUrls("see https://example.com/a.")).toEqual(["https://example.com/a"]);
		expect(extractCitationUrls("visit https://example.com/a,")).toEqual(["https://example.com/a"]);
		expect(extractCitationUrls("go to https://example.com/a)")).toEqual(["https://example.com/a"]);
	});

	it("handles http and https", () => {
		const out = extractCitationUrls("http://a.com and https://b.com");
		expect(out).toContain("http://a.com");
		expect(out).toContain("https://b.com");
	});

	it("returns [] for text without URLs", () => {
		expect(extractCitationUrls("Nothing to cite here.")).toEqual([]);
	});

	it("returns [] for empty string", () => {
		expect(extractCitationUrls("")).toEqual([]);
	});

	it("preserves markdown URL order before inline (markdown-first heuristic)", () => {
		const out = extractCitationUrls("first inline https://b.com then [md](https://a.com)");
		// Markdown extracted first, then inline (that doesn't match markdown) — dedup preserves the first occurrence
		expect(out).toEqual(["https://a.com", "https://b.com"]);
	});
});

// ── normalizeUrl ────────────────────────────────────────────

describe("normalizeUrl", () => {
	it("strips trailing slash from path", () => {
		expect(normalizeUrl("https://example.com/about/")).toBe("https://example.com/about");
	});

	it("preserves the root slash", () => {
		expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
	});

	it("lowercases the host", () => {
		expect(normalizeUrl("https://ExAmPlE.com/A")).toBe("https://example.com/A");
	});

	it("strips www by default", () => {
		expect(normalizeUrl("https://www.example.com/a")).toBe("https://example.com/a");
	});

	it("preserves non-www subdomain (e.g. blog.)", () => {
		expect(normalizeUrl("https://blog.example.com/a")).toBe("https://blog.example.com/a");
	});

	it("strips URL fragments", () => {
		expect(normalizeUrl("https://example.com/a#section")).toBe("https://example.com/a");
	});

	it("strips UTM params but preserves others", () => {
		expect(
			normalizeUrl("https://example.com/a?utm_source=newsletter&utm_medium=email&foo=bar&baz=qux"),
		).toBe("https://example.com/a?foo=bar&baz=qux");
	});

	it("strips fbclid + gclid", () => {
		expect(normalizeUrl("https://example.com/a?fbclid=xyz&gclid=abc&q=real")).toBe(
			"https://example.com/a?q=real",
		);
	});

	it("preserves HTTP vs HTTPS distinction", () => {
		expect(normalizeUrl("http://example.com/a")).toBe("http://example.com/a");
		expect(normalizeUrl("https://example.com/a")).toBe("https://example.com/a");
	});

	it("preserves ports", () => {
		expect(normalizeUrl("https://example.com:8080/a")).toBe("https://example.com:8080/a");
	});

	it("handles IDN domains (via the built-in URL parser punycode encoding)", () => {
		// The built-in URL parser punycode-encodes IDN hosts — this documents
		// current behaviour rather than enforcing it.
		const out = normalizeUrl("https://müller.de/a");
		expect(out.includes("xn--")).toBe(true);
	});

	it("returns the input unchanged when URL is unparseable", () => {
		expect(normalizeUrl("not a url")).toBe("not a url");
		expect(normalizeUrl("")).toBe("");
	});

	it("stripQuery flag removes the full query string", () => {
		expect(normalizeUrl("https://example.com/a?foo=bar", { stripQuery: true })).toBe(
			"https://example.com/a",
		);
	});

	it("can be opted out of www stripping", () => {
		expect(normalizeUrl("https://www.example.com/a", { stripWww: false })).toBe(
			"https://www.example.com/a",
		);
	});

	it("can be opted out of fragment stripping", () => {
		expect(normalizeUrl("https://example.com/a#x", { stripFragment: false })).toBe(
			"https://example.com/a#x",
		);
	});
});

// ── resolveRelative ─────────────────────────────────────────

describe("resolveRelative", () => {
	it("resolves an absolute path against a base", () => {
		expect(resolveRelative("/about", "https://example.com/foo")).toBe("https://example.com/about");
	});

	it("resolves a relative path against a base", () => {
		expect(resolveRelative("sub/page", "https://example.com/a/b")).toBe(
			"https://example.com/a/sub/page",
		);
	});

	it("returns an absolute URL untouched", () => {
		expect(resolveRelative("https://other.com/x", "https://example.com/")).toBe(
			"https://other.com/x",
		);
	});

	it("returns the input unchanged when inputs are invalid", () => {
		expect(resolveRelative("bad", "also bad")).toBe("bad");
	});
});
