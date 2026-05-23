import type { ScanCheck, ScanResult } from "@beacon/shared";
import { scoreToLevel } from "@beacon/shared";
import { buildCheckContext } from "./context.js";
import { FetchError, type FetchResult, fetchUrl } from "./fetcher.js";
import { prefetchSubResources } from "./prefetch.js";
import { type CheckRegistry, defaultRegistry } from "./registry.js";
import {
	calculateCurrentReadiness,
	calculateFutureReadiness,
	calculateLevelScores,
	calculateOverallScore,
	calculateReadinessLevel,
} from "./scoring.js";

export interface ScanOptions {
	timeoutMs?: number;
	registry?: CheckRegistry;
	prefetchedResult?: FetchResult;
}

export class ScannerEngine {
	private registry: CheckRegistry;

	constructor(registry?: CheckRegistry) {
		this.registry = registry ?? defaultRegistry;
	}

	async scan(url: string, options?: ScanOptions): Promise<ScanResult> {
		const registry = options?.registry ?? this.registry;
		const scanId = crypto.randomUUID();
		const createdAt = new Date().toISOString();

		// 1. Fetch URL (skip if prefetched result provided)
		let fetchResult: FetchResult;
		if (options?.prefetchedResult) {
			fetchResult = options.prefetchedResult;
		} else {
			try {
				fetchResult = await fetchUrl(url, options?.timeoutMs);
			} catch (error) {
				const message = error instanceof FetchError ? error.message : "Unknown error";
				return {
					id: scanId,
					url,
					status: "failed",
					overallScore: 0,
					readinessLevel: scoreToLevel(0),
					levelScores: { readability: 0, interactivity: 0, transactional: null },
					checks: [],
					createdAt,
					completedAt: new Date().toISOString(),
					error: message,
				};
			}
		}

		// 2. Prefetch sub-resources in parallel (robots.txt, llms.txt, etc.)
		let subResources: Record<string, import("@beacon/shared").PrefetchedResource | null> = {};
		try {
			subResources = await prefetchSubResources(fetchResult.finalUrl, options?.timeoutMs);
		} catch {
			// Fatal prefetch error (SSRF/TIMEOUT) — continue with empty sub-resources.
			// Individual checks will report "not found" for their sub-resources.
		}

		// 3. Build context (parse HTML once + attach prefetched resources)
		const ctx = buildCheckContext(url, fetchResult, subResources);

		// 4. Run all plugins in parallel
		const plugins = registry.getAll();

		if (plugins.length === 0) {
			return {
				id: scanId,
				url,
				finalUrl: fetchResult.finalUrl,
				status: "failed",
				overallScore: 0,
				readinessLevel: scoreToLevel(0),
				levelScores: { readability: 0, interactivity: 0, transactional: null },
				checks: [],
				createdAt,
				completedAt: new Date().toISOString(),
				error: "No check plugins registered",
			};
		}

		const results = await Promise.allSettled(
			plugins.map((plugin) => {
				try {
					return plugin.run(ctx);
				} catch (err) {
					return Promise.reject(err);
				}
			}),
		);

		// 5. Map results — rejected promises become fail checks
		const checks: ScanCheck[] = plugins.map((plugin, i) => {
			const result = results[i];
			if (!result) {
				throw new Error(`Missing result for plugin ${plugin.id} at index ${i}`);
			}
			if (result.status === "fulfilled") {
				return result.value;
			}

			const errorMessage =
				result.reason instanceof Error ? result.reason.message : "Unknown plugin error";

			return {
				id: plugin.id,
				name: plugin.name,
				status: "error" as const,
				category: plugin.category,
				severity: plugin.severity,
				score: 0,
				summary: `Check fehlgeschlagen: ${errorMessage}`,
				issues: [
					{
						message: errorMessage,
						severity: plugin.severity,
					},
				],
			};
		});

		// 6. Calculate scores
		const overallScore = calculateOverallScore(checks);
		const levelScores = calculateLevelScores(checks);
		const readinessLevel = calculateReadinessLevel(overallScore, checks);

		return {
			id: scanId,
			url,
			finalUrl: fetchResult.finalUrl,
			status: "completed",
			overallScore,
			readinessLevel,
			levelScores,
			checks,
			createdAt,
			completedAt: new Date().toISOString(),
			currentReadiness: calculateCurrentReadiness(checks),
			futureReadiness: calculateFutureReadiness(checks),
		};
	}
}
