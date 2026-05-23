import {
	ClaudeClient,
	analyzeCitationReadiness,
	analyzeSemanticQuality,
	buildCitationPrompt,
	buildSemanticPrompt,
} from "@beacon/ai";
import { db, scanQueries } from "@beacon/db";
import type { AnalysisJobData, AnalysisJobResult } from "@beacon/queue";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";

function isLastAttempt(job: Job): boolean {
	const maxAttempts = job.opts.attempts ?? 1;
	return job.attemptsMade >= maxAttempts - 1;
}

export async function processAnalysis(
	job: Job<AnalysisJobData, AnalysisJobResult>,
): Promise<AnalysisJobResult> {
	const { scanId, type } = job.data;
	const log = createJobLogger({ queue: "analysis", jobId: job.id ?? "unknown", scanId });

	log.info("Starting analysis", { type });

	const scan = await scanQueries.getById(db, scanId);
	if (!scan) {
		throw new Error(`Scan ${scanId} not found`);
	}

	if (!scan.htmlContent) {
		throw new Error(`Scan ${scanId} has no htmlContent — cannot run analysis`);
	}

	// Set status to processing
	await scanQueries.updateAnalysisStatus(db, scanId, type, "processing");

	let client: ClaudeClient;
	try {
		client = ClaudeClient.fromEnv();
	} catch (err) {
		// Config errors are not retryable — always mark as failed
		const message = `CONFIG_ERROR: ${err instanceof Error ? err.message : "Claude API nicht konfiguriert"}`;
		await scanQueries.updateAnalysisStatus(db, scanId, type, "failed", message);
		throw err;
	}

	// Locale-aware preamble (#479): prepended to the existing German JSON
	// prompt so schema validation is never affected.
	const { loadLocalePrompt } = await import("../lib/locale-prompt.js");
	const preambleResult = await loadLocalePrompt(db, {
		requestedLocaleId: scan.localeId ?? null,
		key: "readiness_check",
		hardcodedFallback: "",
		logContext: { queue: "analysis", jobId: job.id ?? "unknown", scanId, type },
	});
	const preamble = preambleResult.systemPrompt;

	try {
		if (type === "semantic") {
			const result = await analyzeSemanticQuality(scan.htmlContent, scan.url, client, {
				systemPromptOverride: buildSemanticPrompt(preamble),
			});
			if (!result.ok) {
				throw new Error(`Semantic analysis failed: ${result.error.message}`);
			}
			await scanQueries.updateAiAnalysis(db, scanId, JSON.stringify(result.data));
		} else {
			const result = await analyzeCitationReadiness(scan.htmlContent, scan.url, client, {
				systemPromptOverride: buildCitationPrompt(preamble),
			});
			if (!result.ok) {
				throw new Error(`Citation analysis failed: ${result.error.message}`);
			}
			await scanQueries.updateCitationAnalysis(db, scanId, JSON.stringify(result.data));
		}

		await scanQueries.updateAnalysisStatus(db, scanId, type, "completed");
		log.info("Analysis completed", {
			type,
			localeId: preambleResult.resolvedLocaleId,
			languageCode: preambleResult.languageCode,
			usedFallback: preambleResult.usedFallback,
			usedHardcodedDefault: preambleResult.usedHardcodedDefault,
		});

		return { scanId, analysisComplete: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unbekannter Fehler";
		if (isLastAttempt(job)) {
			// Final attempt — persist terminal failure
			await scanQueries.updateAnalysisStatus(db, scanId, type, "failed", message);
		}
		// On non-final attempts, status stays "processing" so retries work
		throw err;
	}
}
