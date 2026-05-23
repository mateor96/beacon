import { describe, expect, it } from "vitest";
import { type CrawlFetcher, type FetchedPage, crawl } from "../crawler.js";

function makeFetcher(pages: Record<string, FetchedPage>, robots = ""): CrawlFetcher {
	return {
		async fetchPage(url) {
			return pages[url] ?? null;
		},
		async fetchText(url) {
			if (url.endsWith("/robots.txt")) return robots;
			return null;
		},
	};
}

describe("crawl", () => {
	it("BFS discovers same-origin links up to maxDepth", async () => {
		const fetcher = makeFetcher({
			"https://example.com/": {
				url: "https://example.com/",
				status: 200,
				html: '<a href="/a">A</a><a href="/b">B</a>',
			},
			"https://example.com/a": {
				url: "https://example.com/a",
				status: 200,
				html: '<a href="/c">C</a>',
			},
			"https://example.com/b": {
				url: "https://example.com/b",
				status: 200,
				html: "",
			},
			"https://example.com/c": {
				url: "https://example.com/c",
				status: 200,
				html: "",
			},
		});

		const result = await crawl(fetcher, {
			rootUrl: "https://example.com/",
			maxPages: 50,
			maxDepth: 2,
			politenessMs: 0,
			concurrency: 2,
		});

		const urls = result.pages.map((p) => p.url);
		expect(urls).toContain("https://example.com/");
		expect(urls).toContain("https://example.com/a");
		expect(urls).toContain("https://example.com/b");
		expect(urls).toContain("https://example.com/c");
	});

	it("respects maxPages cap", async () => {
		const fetcher = makeFetcher({
			"https://example.com/": {
				url: "https://example.com/",
				status: 200,
				html: '<a href="/a">A</a><a href="/b">B</a><a href="/c">C</a><a href="/d">D</a>',
			},
			"https://example.com/a": { url: "https://example.com/a", status: 200, html: "" },
			"https://example.com/b": { url: "https://example.com/b", status: 200, html: "" },
			"https://example.com/c": { url: "https://example.com/c", status: 200, html: "" },
			"https://example.com/d": { url: "https://example.com/d", status: 200, html: "" },
		});

		const result = await crawl(fetcher, {
			rootUrl: "https://example.com/",
			maxPages: 3,
			politenessMs: 0,
			concurrency: 2,
		});

		expect(result.pagesProcessed).toBeLessThanOrEqual(3);
	});

	it("blocks pages under robots Disallow", async () => {
		const fetcher = makeFetcher(
			{
				"https://example.com/": {
					url: "https://example.com/",
					status: 200,
					html: '<a href="/admin/dashboard">Admin</a><a href="/blog">Blog</a>',
				},
				"https://example.com/blog": {
					url: "https://example.com/blog",
					status: 200,
					html: "",
				},
			},
			"User-agent: *\nDisallow: /admin\n",
		);

		const result = await crawl(fetcher, {
			rootUrl: "https://example.com/",
			politenessMs: 0,
			concurrency: 2,
		});

		const blocked = result.pages.find((p) => p.url === "https://example.com/admin/dashboard");
		expect(blocked?.status).toBe("blocked-by-robots");
		expect(result.robotsBlocked).toBe(1);
	});

	it("does not follow cross-origin links", async () => {
		const fetcher = makeFetcher({
			"https://example.com/": {
				url: "https://example.com/",
				status: 200,
				html: '<a href="https://other.com/foo">other</a><a href="/local">local</a>',
			},
			"https://example.com/local": { url: "https://example.com/local", status: 200, html: "" },
		});

		const result = await crawl(fetcher, {
			rootUrl: "https://example.com/",
			politenessMs: 0,
			concurrency: 2,
		});

		const urls = result.pages.map((p) => p.url);
		expect(urls).toContain("https://example.com/local");
		expect(urls.some((u) => u.startsWith("https://other.com"))).toBe(false);
	});

	it("seeds queue from sitemap URLs", async () => {
		const fetcher: CrawlFetcher = {
			async fetchPage(url) {
				return { url, status: 200, html: "" };
			},
			async fetchText(url) {
				if (url.endsWith("/robots.txt")) {
					return "Sitemap: https://example.com/sitemap.xml\nUser-agent: *\nDisallow:\n";
				}
				if (url === "https://example.com/sitemap.xml") {
					return `
						<urlset>
							<url><loc>https://example.com/sm1</loc></url>
							<url><loc>https://example.com/sm2</loc></url>
						</urlset>
					`;
				}
				return null;
			},
		};

		const result = await crawl(fetcher, {
			rootUrl: "https://example.com/",
			maxPages: 50,
			politenessMs: 0,
			concurrency: 2,
		});
		const urls = result.pages.map((p) => p.url);
		expect(urls).toContain("https://example.com/sm1");
		expect(urls).toContain("https://example.com/sm2");
	});

	it("limits concurrency", async () => {
		let inFlight = 0;
		let peak = 0;
		const fetcher: CrawlFetcher = {
			async fetchPage(url) {
				inFlight += 1;
				peak = Math.max(peak, inFlight);
				await new Promise((r) => setTimeout(r, 5));
				inFlight -= 1;
				return { url, status: 200, html: "" };
			},
			async fetchText() {
				return null;
			},
		};

		// 6 same-origin links from the root, max concurrency 2
		const links = Array.from({ length: 6 }, (_, i) => `<a href="/p${i}">p${i}</a>`).join("");
		const pages: Record<string, FetchedPage> = {
			"https://example.com/": { url: "https://example.com/", status: 200, html: links },
		};
		for (let i = 0; i < 6; i++) {
			pages[`https://example.com/p${i}`] = {
				url: `https://example.com/p${i}`,
				status: 200,
				html: "",
			};
		}
		const localFetcher: CrawlFetcher = {
			async fetchPage(url) {
				inFlight += 1;
				peak = Math.max(peak, inFlight);
				await new Promise((r) => setTimeout(r, 5));
				inFlight -= 1;
				return pages[url] ?? null;
			},
			async fetchText() {
				return null;
			},
		};
		void fetcher;

		await crawl(localFetcher, {
			rootUrl: "https://example.com/",
			politenessMs: 0,
			concurrency: 2,
		});

		expect(peak).toBeLessThanOrEqual(2);
	});
});
