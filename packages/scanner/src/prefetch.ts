import type { PrefetchedResource } from "@beacon/shared";
import { isHtmlResponse } from "@beacon/shared";
import { FetchError, fetchUrl } from "./fetcher.js";

/** All sub-resource paths to prefetch before running checks. */
const PREFETCH_PATHS = [
	"/robots.txt",
	"/sitemap.xml",
	"/llms.txt",
	"/llms-full.txt",
	"/.well-known/agents.md",
	"/agents.md",
	"/.well-known/mcp.json",
] as const;

/**
 * Prefetches all well-known sub-resources in parallel.
 * Returns a map keyed by path. Entries are null when the resource was
 * not found (404, network error) or returned an HTML soft-404.
 * SSRF_BLOCKED / TIMEOUT / RESPONSE_TOO_LARGE errors propagate —
 * they indicate an infrastructure-level issue that should fail the scan.
 */
export async function prefetchSubResources(
	finalUrl: string,
	timeoutMs?: number,
): Promise<Record<string, PrefetchedResource | null>> {
	const results = await Promise.allSettled(
		PREFETCH_PATHS.map(async (path) => {
			const url = new URL(path, finalUrl).toString();
			try {
				const result = await fetchUrl(url, timeoutMs);
				if (result.statusCode < 200 || result.statusCode >= 300) {
					return { path, resource: null };
				}
				if (isHtmlResponse(result.html)) {
					return { path, resource: null };
				}
				return {
					path,
					resource: { content: result.html, statusCode: result.statusCode, source: path },
				};
			} catch (err) {
				if (
					err instanceof FetchError &&
					(err.code === "SSRF_BLOCKED" ||
						err.code === "TIMEOUT" ||
						err.code === "RESPONSE_TOO_LARGE")
				) {
					throw err;
				}
				return { path, resource: null };
			}
		}),
	);

	const map: Record<string, PrefetchedResource | null> = {};
	for (const entry of results) {
		if (entry.status === "fulfilled") {
			map[entry.value.path] = entry.value.resource;
		} else {
			throw entry.reason;
		}
	}

	return map;
}
