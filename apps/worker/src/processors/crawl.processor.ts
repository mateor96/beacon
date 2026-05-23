import { type CrawlFetcher, crawl } from "@beacon/crawler";
import { crawlQueries, db } from "@beacon/db";
import type { CrawlJobData, CrawlJobResult } from "@beacon/queue";
import { fetchUrl } from "@beacon/scanner";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";

/**
 * Multi-page crawl processor (v0.2 #10).
 *
 * Wraps the pure crawler from @beacon/crawler with the SSRF-safe
 * fetcher from @beacon/scanner and persists each discovered page as a
 * site_crawl_pages row. Updates the parent site_crawls row's status
 * and stats.
 */
export async function processCrawl(
	job: Job<CrawlJobData, CrawlJobResult>,
): Promise<CrawlJobResult> {
	const { crawlId, rootUrl, maxPages, maxDepth } = job.data;
	const log = createJobLogger({ queue: "crawl", jobId: job.id ?? "unknown", scanId: crawlId });

	await crawlQueries.updateStatus(db, crawlId, "crawling");

	const fetcher: CrawlFetcher = {
		async fetchPage(url) {
			try {
				const result = await fetchUrl(url);
				return { url, status: result.statusCode, html: result.html };
			} catch (err) {
				log.warn("fetchPage failed", {
					url,
					error: err instanceof Error ? err.message : String(err),
				});
				return null;
			}
		},
		async fetchText(url) {
			try {
				const result = await fetchUrl(url);
				return result.html;
			} catch {
				return null;
			}
		},
	};

	try {
		const result = await crawl(fetcher, {
			rootUrl,
			maxPages: maxPages ?? 200,
			maxDepth: maxDepth ?? 3,
			politenessMs: 100,
			concurrency: 4,
		});

		// Persist one row per discovered page.
		if (result.pages.length > 0) {
			await crawlQueries.addPages(
				db,
				result.pages.map((p) => ({
					crawlId,
					url: p.url,
					depth: p.depth,
					status:
						p.status === "completed" ? "completed" : p.status === "failed" ? "failed" : "pending",
				})),
			);
		}

		await crawlQueries.updateStats(db, crawlId, {
			pagesFound: result.pagesDiscovered,
			pagesScanned: result.pagesProcessed,
		});
		await crawlQueries.updateStatus(db, crawlId, "completed", new Date());

		log.info("Crawl completed", {
			pagesProcessed: result.pagesProcessed,
			robotsBlocked: result.robotsBlocked,
			durationMs: result.durationMs,
		});

		return {
			crawlId,
			pagesProcessed: result.pagesProcessed,
			robotsBlocked: result.robotsBlocked,
		};
	} catch (err) {
		log.error("Crawl failed", err);
		await crawlQueries.updateStatus(db, crawlId, "failed", new Date());
		throw err;
	}
}
