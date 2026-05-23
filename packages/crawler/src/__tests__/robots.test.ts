import { describe, expect, it } from "vitest";
import { isPathAllowed, parseRobots } from "../robots.js";

describe("parseRobots", () => {
	it("collects disallow paths for User-agent: *", () => {
		const rules = parseRobots(`
			User-agent: *
			Disallow: /admin
			Disallow: /private
		`);
		expect(rules.disallowedPaths).toContain("/admin");
		expect(rules.disallowedPaths).toContain("/private");
	});

	it("matches the BeaconBot user-agent specifically", () => {
		const rules = parseRobots(`
			User-agent: BeaconBot
			Disallow: /no-crawl
		`);
		expect(rules.disallowedPaths).toContain("/no-crawl");
	});

	it("collects top-level Sitemap entries", () => {
		const rules = parseRobots(`
			Sitemap: https://example.com/sitemap.xml
			Sitemap: https://example.com/news.xml
			User-agent: *
			Disallow:
		`);
		expect(rules.sitemaps).toEqual([
			"https://example.com/sitemap.xml",
			"https://example.com/news.xml",
		]);
	});

	it("ignores other user-agent sections", () => {
		const rules = parseRobots(`
			User-agent: Googlebot
			Disallow: /google-only
			User-agent: *
			Disallow: /shared
		`);
		expect(rules.disallowedPaths).toContain("/shared");
		expect(rules.disallowedPaths).not.toContain("/google-only");
	});
});

describe("isPathAllowed", () => {
	it("blocks disallowed prefixes", () => {
		const rules = { disallowedPaths: ["/admin"], sitemaps: [] };
		expect(isPathAllowed(rules, "/admin")).toBe(false);
		expect(isPathAllowed(rules, "/admin/")).toBe(false);
		expect(isPathAllowed(rules, "/admin/users")).toBe(false);
	});

	it("allows non-matching paths", () => {
		const rules = { disallowedPaths: ["/admin"], sitemaps: [] };
		expect(isPathAllowed(rules, "/")).toBe(true);
		expect(isPathAllowed(rules, "/blog")).toBe(true);
	});

	it("blocks everything when '/' is disallowed", () => {
		const rules = { disallowedPaths: ["/"], sitemaps: [] };
		expect(isPathAllowed(rules, "/anything")).toBe(false);
		expect(isPathAllowed(rules, "/")).toBe(false);
	});
});
