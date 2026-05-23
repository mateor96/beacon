import { db, scanQueries } from "@beacon/db";
import type { ScanJobData, ScanJobResult } from "@beacon/queue";
import { FetchError, ScannerEngine, fetchUrl } from "@beacon/scanner";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";

const engine = new ScannerEngine();

function isLastAttempt(job: Job): boolean {
	const maxAttempts = job.opts.attempts ?? 1;
	return job.attemptsMade >= maxAttempts - 1;
}

export async function processScan(job: Job<ScanJobData, ScanJobResult>): Promise<ScanJobResult> {
	const { scanId, url, localeId } = job.data;
	const log = createJobLogger({ queue: "scan", jobId: job.id ?? "unknown", scanId });
	const startMs = Date.now();

	log.info("Starting scan", { url, localeId });

	let scan: Awaited<ReturnType<typeof scanQueries.getById>> | undefined;

	try {
		scan = await scanQueries.getById(db, scanId);
		if (!scan) {
			throw new Error(`Scan ${scanId} not found`);
		}

		if (localeId) {
			await scanQueries.updateLocale(db, scanId, localeId);
		}

		await scanQueries.updateStatus(db, scanId, "processing");

		// E2E stub: return canned results without fetching external URLs
		if (process.env.E2E_STUB_SCAN === "true") {
			const { E2E_STUB_CHECKS, E2E_STUB_LEVEL_SCORES, E2E_STUB_SCORE, E2E_STUB_READINESS_LEVEL } =
				await import("../lib/e2e-stub.js");
			const durationMs = Date.now() - startMs;
			await scanQueries.updateResults(db, scanId, {
				score: E2E_STUB_SCORE,
				readinessLevel: E2E_STUB_READINESS_LEVEL,
				levelScores: E2E_STUB_LEVEL_SCORES,
				checks: E2E_STUB_CHECKS,
				finalUrl: url,
				htmlContent: "<html><body>E2E stub</body></html>",
			});
			await scanQueries.updateStatus(db, scanId, "completed", undefined, durationMs);
			log.info("E2E stub scan completed", { durationMs });
			return { scanId, overallScore: E2E_STUB_SCORE, readinessLevel: E2E_STUB_READINESS_LEVEL };
		}

		let fetchResult: Awaited<ReturnType<typeof fetchUrl>>;
		try {
			fetchResult = await fetchUrl(url);
		} catch (err) {
			if (err instanceof FetchError) {
				const durationMs = Date.now() - startMs;
				log.warn("Site unreachable", { code: err.code, error: err.message, durationMs });
				await scanQueries.updateStatus(db, scanId, "failed", err.message, durationMs);
				return { scanId, overallScore: 0, readinessLevel: 0 };
			}
			throw err;
		}

		const result = await engine.scan(url, { prefetchedResult: fetchResult });

		if (result.status === "failed") {
			throw new Error(`Scanner internal failure: ${result.error ?? "unknown"}`);
		}

		const durationMs = Date.now() - startMs;

		await scanQueries.updateResults(db, scanId, {
			score: result.overallScore,
			readinessLevel: result.readinessLevel,
			levelScores: result.levelScores,
			checks: result.checks,
			finalUrl: result.finalUrl,
			htmlContent: fetchResult.html,
		});

		await scanQueries.updateStatus(db, scanId, "completed", undefined, durationMs);

		log.info("Scan completed", {
			overallScore: result.overallScore,
			readinessLevel: result.readinessLevel,
			durationMs,
		});

		// Fan out scan.completed webhook event to subscribed instance-scoped
		// endpoints. Failure here must not fail the scan; we only log.
		try {
			const { dispatchWebhookEvent } = await import("@beacon/api-sdk");
			const fired = await dispatchWebhookEvent("scan.completed", {
				scanId,
				url: job.data.url,
				finalUrl: result.finalUrl ?? null,
				overallScore: result.overallScore,
				readinessLevel: result.readinessLevel,
				levelScores: result.levelScores,
				scannedAt: new Date().toISOString(),
			});
			if (fired.length > 0) {
				log.info("Fired scan.completed webhook(s)", { count: fired.length });
			}
		} catch (whErr) {
			log.warn("Webhook dispatch failed (non-fatal)", {
				error: whErr instanceof Error ? whErr.message : String(whErr),
			});
		}

		return {
			scanId,
			overallScore: result.overallScore,
			readinessLevel: result.readinessLevel,
		};
	} catch (err) {
		const durationMs = Date.now() - startMs;
		if (isLastAttempt(job)) {
			try {
				const message = err instanceof Error ? err.message : String(err);
				await scanQueries.updateStatus(db, scanId, "failed", message, durationMs);
			} catch (dbErr) {
				log.error("Failed to update scan status to failed", dbErr);
			}
		}

		log.error("Scan failed", err, { durationMs });
		throw err;
	}
}
