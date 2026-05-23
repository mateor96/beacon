import { describe, expect, it } from "vitest";
import { extractInternalLinks } from "../links.js";

describe("extractInternalLinks", () => {
	it("returns same-origin links resolved against the base", () => {
		const html = `
			<a href="/about">About</a>
			<a href="/blog/hello">Blog</a>
			<a href="https://example.com/contact">Contact</a>
		`;
		const links = extractInternalLinks(html, "https://example.com/");
		expect(links).toContain("https://example.com/about");
		expect(links).toContain("https://example.com/blog/hello");
		expect(links).toContain("https://example.com/contact");
	});

	it("drops cross-origin links", () => {
		const html = `<a href="https://elsewhere.com/page">elsewhere</a>`;
		const links = extractInternalLinks(html, "https://example.com/");
		expect(links).toEqual([]);
	});

	it("drops javascript:, mailto:, tel: schemes", () => {
		const html = `
			<a href="javascript:void(0)">js</a>
			<a href="mailto:hello@example.com">mail</a>
			<a href="tel:123">phone</a>
			<a href="/keep">keep</a>
		`;
		const links = extractInternalLinks(html, "https://example.com/");
		expect(links).toEqual(["https://example.com/keep"]);
	});

	it("strips fragments", () => {
		const html = `<a href="/page#section">section</a>`;
		const links = extractInternalLinks(html, "https://example.com/");
		expect(links).toEqual(["https://example.com/page"]);
	});
});
