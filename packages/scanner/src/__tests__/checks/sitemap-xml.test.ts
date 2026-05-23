import type { CheckContext } from "@beacon/shared";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

const { default: sitemapXmlCheck } = await import("../../checks/sitemap-xml.js");

// ── Helpers ─────────────────────────────────────────────────

function makeContext(overrides: Partial<CheckContext> = {}): CheckContext {
	const html = overrides.html ?? "<html><body>Hello</body></html>";
	return {
		inputUrl: "https://example.com",
		finalUrl: "https://example.com",
		html,
		parsedHtml: parse(html),
		responseTime: 100,
		statusCode: 200,
		redirects: [],
		subResources: {},
		...overrides,
	};
}

// ── Fixtures ────────────────────────────────────────────────

const VALID_FULL = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><lastmod>2024-01-15</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://example.com/about</loc><lastmod>2024-01-10</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://example.com/blog</loc><lastmod>2024-01-14</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>https://example.com/contact</loc><lastmod>2024-01-01</lastmod><changefreq>yearly</changefreq><priority>0.5</priority></url>
  <url><loc>https://example.com/products</loc><lastmod>2024-01-12</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://example.com/services</loc><lastmod>2024-01-08</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://example.com/faq</loc><lastmod>2024-01-05</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
  <url><loc>https://example.com/team</loc><lastmod>2024-01-03</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>
  <url><loc>https://example.com/blog/post-1</loc><lastmod>2024-01-14</lastmod><changefreq>never</changefreq><priority>0.6</priority></url>
  <url><loc>https://example.com/blog/post-2</loc><lastmod>2024-01-13</lastmod><changefreq>never</changefreq><priority>0.6</priority></url>
  <url><loc>https://example.com/blog/post-3</loc><lastmod>2024-01-12</lastmod><changefreq>never</changefreq><priority>0.6</priority></url>
</urlset>`;

const MINIMAL = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
</urlset>`;

const SITEMAP_INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-pages.xml</loc><lastmod>2024-01-15</lastmod></sitemap>
  <sitemap><loc>https://example.com/sitemap-blog.xml</loc><lastmod>2024-01-14</lastmod></sitemap>
  <sitemap><loc>https://example.com/sitemap-products.xml</loc><lastmod>2024-01-12</lastmod></sitemap>
</sitemapindex>`;

const NO_LASTMOD = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://example.com/about</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://example.com/blog</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>https://example.com/contact</loc><changefreq>yearly</changefreq><priority>0.5</priority></url>
  <url><loc>https://example.com/products</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://example.com/services</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://example.com/faq</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>
  <url><loc>https://example.com/team</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
  <url><loc>https://example.com/blog/post-1</loc><changefreq>never</changefreq><priority>0.6</priority></url>
  <url><loc>https://example.com/blog/post-2</loc><changefreq>never</changefreq><priority>0.6</priority></url>
  <url><loc>https://example.com/blog/post-3</loc><changefreq>never</changefreq><priority>0.6</priority></url>
</urlset>`;

const MALFORMED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>`;

const NO_ROOT = `<?xml version="1.0" encoding="UTF-8"?>
<stuff>
  <thing>hello</thing>
</stuff>`;

const HTML_RESPONSE = `<!DOCTYPE html>
<html><head><title>404</title></head>
<body><h1>Not Found</h1></body></html>`;

const ROBOTS_WITH_SITEMAP = `User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
`;

// ── Tests ───────────────────────────────────────────────────

describe("sitemap-xml check", () => {
	describe("metadata", () => {
		it("has correct id, category, and severity", () => {
			expect(sitemapXmlCheck.id).toBe("sitemap-xml");
			expect(sitemapXmlCheck.category).toBe("readability");
			expect(sitemapXmlCheck.severity).toBe("important");
		});
	});

	describe("file not found", () => {
		it("returns fail with score 0 when not prefetched", async () => {
			const result = await sitemapXmlCheck.run(makeContext());

			expect(result.status).toBe("fail");
			expect(result.score).toBe(0);
			expect(result.issues.length).toBeGreaterThanOrEqual(1);
			expect(result.issues[0].severity).toBe("important");
		});
	});

	describe("soft-404 detection", () => {
		it("returns fail when server returns HTML instead of XML", async () => {
			const result = await sitemapXmlCheck.run(
				makeContext({
					subResources: {
						"/sitemap.xml": { content: HTML_RESPONSE, statusCode: 200, source: "/sitemap.xml" },
					},
				}),
			);

			expect(result.status).toBe("fail");
			expect(result.score).toBe(0);
			expect(result.issues[0].message).toContain("HTML");
		});
	});

	describe("empty file", () => {
		it("returns fail with exists points for empty file", async () => {
			const result = await sitemapXmlCheck.run(
				makeContext({
					subResources: {
						"/sitemap.xml": { content: "", statusCode: 200, source: "/sitemap.xml" },
					},
				}),
			);

			expect(result.status).toBe("fail");
			expect(result.score).toBe(20); // only exists points
			expect(result.issues[0].message).toContain("leer");
		});

		it("returns fail for whitespace-only file", async () => {
			const result = await sitemapXmlCheck.run(
				makeContext({
					subResources: {
						"/sitemap.xml": { content: "   \n  \n  ", statusCode: 200, source: "/sitemap.xml" },
					},
				}),
			);

			expect(result.status).toBe("fail");
			expect(result.score).toBe(20);
		});
	});

	describe("valid sitemap", () => {
		it("returns pass with high score for complete sitemap with robots.txt ref", async () => {
			const result = await sitemapXmlCheck.run(
				makeContext({
					subResources: {
						"/sitemap.xml": { content: VALID_FULL, statusCode: 200, source: "/sitemap.xml" },
						"/robots.txt": { content: ROBOTS_WITH_SITEMAP, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			expect(result.status).toBe("pass");
			expect(result.score).toBe(100);
		});

		it("valid sitemap without robots.txt ref loses 10 points", async () => {
			const result = await sitemapXmlCheck.run(
				makeContext({
					subResources: {
						"/sitemap.xml": { content: VALID_FULL, statusCode: 200, source: "/sitemap.xml" },
					},
				}),
			);

			expect(result.status).toBe("pass");
			expect(result.score).toBe(90);
			expect(result.issues.some((i) => i.message.includes("robots.txt"))).toBe(true);
		});
	});

	describe("minimal sitemap", () => {
		it("scores partial for sitemap with few URLs and no metadata", async () => {
			const result = await sitemapXmlCheck.run(
				makeContext({
					subResources: {
						"/sitemap.xml": { content: MINIMAL, statusCode: 200, source: "/sitemap.xml" },
					},
				}),
			);

			// exists(20) + validXml(15) + urlCount(10, partial) + hasLastmod(0) + changefreq(0) + priority(0) + robotsTxtRef(0) + namespace(5) = 50
			expect(result.score).toBe(50);
			expect(result.status).toBe("warn");
			expect(result.issues.some((i) => i.message.includes("Aktualisierungsdatum"))).toBe(true);
		});
	});

	describe("sitemap index", () => {
		it("detects sitemap index and scores appropriately", async () => {
			const result = await sitemapXmlCheck.run(
				makeContext({
					subResources: {
						"/sitemap.xml": { content: SITEMAP_INDEX, statusCode: 200, source: "/sitemap.xml" },
					},
				}),
			);

			expect(result.score).toBeGreaterThanOrEqual(50);
			expect(result.details?.isSitemapIndex).toBe(true);
			expect(result.details?.entryCount).toBe(3);
			expect(result.issues.some((i) => i.message.includes("Sitemap-Index"))).toBe(true);
		});
	});

	describe("no lastmod dates", () => {
		it("loses lastmod points but keeps others", async () => {
			const result = await sitemapXmlCheck.run(
				makeContext({
					subResources: {
						"/sitemap.xml": { content: NO_LASTMOD, statusCode: 200, source: "/sitemap.xml" },
						"/robots.txt": { content: ROBOTS_WITH_SITEMAP, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			// exists(20) + validXml(15) + urlCount(20) + hasLastmod(0) + changefreq(5) + priority(5) + robotsTxtRef(10) + namespace(5) = 80
			expect(result.score).toBe(80);
			expect(result.issues.some((i) => i.message.includes("Aktualisierungsdatum"))).toBe(true);
		});
	});

	describe("malformed XML", () => {
		it("returns lower score for unclosed root element", async () => {
			const result = await sitemapXmlCheck.run(
				makeContext({
					subResources: {
						"/sitemap.xml": { content: MALFORMED_XML, statusCode: 200, source: "/sitemap.xml" },
					},
				}),
			);

			expect(result.score).toBeLessThan(80);
			expect(result.issues.some((i) => i.message.includes("fehlerhaft strukturiert"))).toBe(true);
		});
	});

	describe("no recognized root element", () => {
		it("returns low score when no urlset or sitemapindex", async () => {
			const result = await sitemapXmlCheck.run(
				makeContext({
					subResources: {
						"/sitemap.xml": { content: NO_ROOT, statusCode: 200, source: "/sitemap.xml" },
					},
				}),
			);

			expect(result.score).toBeLessThan(40);
			expect(result.status).toBe("fail");
			expect(result.issues.some((i) => i.message.includes("Wurzelelement"))).toBe(true);
		});
	});

	describe("robots.txt cross-reference", () => {
		it("awards points when robots.txt has Sitemap directive", async () => {
			const withRef = await sitemapXmlCheck.run(
				makeContext({
					subResources: {
						"/sitemap.xml": { content: VALID_FULL, statusCode: 200, source: "/sitemap.xml" },
						"/robots.txt": { content: ROBOTS_WITH_SITEMAP, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);
			const withoutRef = await sitemapXmlCheck.run(
				makeContext({
					subResources: {
						"/sitemap.xml": { content: VALID_FULL, statusCode: 200, source: "/sitemap.xml" },
					},
				}),
			);

			expect(withRef.score).toBeGreaterThan(withoutRef.score);
		});
	});

	describe("details object", () => {
		it("contains expected fields for valid sitemap", async () => {
			const result = await sitemapXmlCheck.run(
				makeContext({
					subResources: {
						"/sitemap.xml": { content: VALID_FULL, statusCode: 200, source: "/sitemap.xml" },
					},
				}),
			);
			const details = result.details as Record<string, unknown>;

			expect(details.rootElement).toBe("urlset");
			expect(details.isSitemapIndex).toBe(false);
			expect(details.entryCount).toBe(11);
			expect(details.lastmodCount).toBe(11);
			expect(details.changefreqCount).toBe(11);
			expect(details.priorityCount).toBe(11);
			expect(details.xmlWellFormed).toBe(true);
			expect(details.namespace).toBe("http://www.sitemaps.org/schemas/sitemap/0.9");
		});
	});
});
