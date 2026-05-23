import { extractInternalLinks } from "./links.js";
import { type RobotsRules, isPathAllowed, parseRobots } from "./robots.js";
import { parseSitemap } from "./sitemap.js";

export interface FetchedPage {
	url: string;
	status: number;
	html: string;
}

export interface CrawlFetcher {
	fetchPage(url: string): Promise<FetchedPage | null>;
	fetchText(url: string): Promise<string | null>;
}

export interface CrawlOptions {
	rootUrl: string;
	maxPages?: number; // default 200
	maxDepth?: number; // default 3
	politenessMs?: number; // delay between fetches to the same host. default 100
	concurrency?: number; // default 4
	respectRobots?: boolean; // default true
}

export interface CrawlPageResult {
	url: string;
	depth: number;
	status: "completed" | "failed" | "blocked-by-robots";
	httpStatus: number | null;
	error?: string;
}

export interface CrawlResult {
	rootUrl: string;
	pagesProcessed: number;
	pagesDiscovered: number;
	pages: CrawlPageResult[];
	robotsBlocked: number;
	durationMs: number;
}

const DEFAULTS = {
	maxPages: 200,
	maxDepth: 3,
	politenessMs: 100,
	concurrency: 4,
	respectRobots: true,
};

/**
 * Breadth-first crawl with same-origin enforcement, robots.txt respect,
 * configurable concurrency + politeness. Pure: the caller injects a
 * fetcher and persists results.
 */
export async function crawl(fetcher: CrawlFetcher, opts: CrawlOptions): Promise<CrawlResult> {
	const cfg = { ...DEFAULTS, ...opts };
	const startedAt = Date.now();

	let root: URL;
	try {
		root = new URL(cfg.rootUrl);
	} catch {
		throw new Error(`crawl: invalid rootUrl ${cfg.rootUrl}`);
	}

	// 1. Robots (best-effort).
	let robots: RobotsRules = { disallowedPaths: [], sitemaps: [] };
	if (cfg.respectRobots) {
		const robotsText = await fetcher.fetchText(new URL("/robots.txt", root).toString());
		if (robotsText) {
			robots = parseRobots(robotsText);
		}
	}

	// 2. Seed queue: root + sitemap URLs (capped at maxPages*2 from sitemap).
	const queue: Array<{ url: string; depth: number }> = [{ url: root.toString(), depth: 0 }];
	const seen = new Set<string>([root.toString()]);

	for (const sitemapUrl of robots.sitemaps.slice(0, 3)) {
		const xml = await fetcher.fetchText(sitemapUrl);
		if (!xml) continue;
		const { urls } = parseSitemap(xml);
		for (const u of urls.slice(0, cfg.maxPages * 2)) {
			if (seen.has(u)) continue;
			try {
				const parsed = new URL(u);
				if (parsed.origin !== root.origin) continue;
				seen.add(u);
				queue.push({ url: u, depth: 1 });
			} catch {
				// skip malformed
			}
		}
	}

	// 3. BFS with per-host politeness delay.
	const results: CrawlPageResult[] = [];
	let robotsBlocked = 0;

	async function processOne(entry: { url: string; depth: number }) {
		const parsed = new URL(entry.url);
		if (cfg.respectRobots && !isPathAllowed(robots, parsed.pathname)) {
			robotsBlocked += 1;
			results.push({
				url: entry.url,
				depth: entry.depth,
				status: "blocked-by-robots",
				httpStatus: null,
			});
			return;
		}

		await new Promise((r) => setTimeout(r, cfg.politenessMs));
		const page = await fetcher.fetchPage(entry.url);
		if (!page) {
			results.push({
				url: entry.url,
				depth: entry.depth,
				status: "failed",
				httpStatus: null,
				error: "fetcher returned null",
			});
			return;
		}

		results.push({
			url: entry.url,
			depth: entry.depth,
			status: page.status >= 200 && page.status < 300 ? "completed" : "failed",
			httpStatus: page.status,
		});

		if (page.status < 200 || page.status >= 300) return;
		if (entry.depth >= cfg.maxDepth) return;

		const links = extractInternalLinks(page.html, entry.url);
		for (const link of links) {
			if (results.length + queue.length >= cfg.maxPages) break;
			if (seen.has(link)) continue;
			seen.add(link);
			queue.push({ url: link, depth: entry.depth + 1 });
		}
	}

	// Worker loop with bounded concurrency.
	const inFlight: Set<Promise<void>> = new Set();
	while (queue.length > 0 || inFlight.size > 0) {
		while (
			queue.length > 0 &&
			inFlight.size < cfg.concurrency &&
			results.length + inFlight.size < cfg.maxPages
		) {
			const next = queue.shift();
			if (!next) break;
			const promise = processOne(next).finally(() => {
				inFlight.delete(promise);
			});
			inFlight.add(promise);
		}
		if (inFlight.size === 0) break;
		await Promise.race(inFlight);
	}

	return {
		rootUrl: cfg.rootUrl,
		pagesProcessed: results.length,
		pagesDiscovered: seen.size,
		pages: results,
		robotsBlocked,
		durationMs: Date.now() - startedAt,
	};
}

export const CRAWLER_VERSION = "1.0.0" as const;
