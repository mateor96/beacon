import { ClaudeClient, generateFix } from "@beacon/ai";
import type { FixGeneratorContext, ValidatedGeneratedFix } from "@beacon/ai";
import { db, mergeScanFixes, scanQueries } from "@beacon/db";
import type { FixJobData, FixJobResult } from "@beacon/queue";
import type { FixGeneratorId } from "@beacon/shared";
import { FIX_GENERATOR_IDS } from "@beacon/shared";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";

const validIds = new Set<string>(FIX_GENERATOR_IDS);

function isLastAttempt(job: Job): boolean {
	const maxAttempts = job.opts.attempts ?? 1;
	return job.attemptsMade >= maxAttempts - 1;
}

export async function processFix(job: Job<FixJobData, FixJobResult>): Promise<FixJobResult> {
	const { scanId, checkIds } = job.data;
	const log = createJobLogger({ queue: "fix", jobId: job.id ?? "unknown", scanId });

	log.info("Starting fix generation", { checkIds });

	// Fetch scan from DB
	const scan = await scanQueries.getById(db, scanId);
	if (!scan) {
		throw new Error(`Scan ${scanId} not found`);
	}

	// Guard: htmlContent is required for FixGeneratorContext
	if (!scan.htmlContent) {
		throw new Error(`Scan ${scanId} has no htmlContent — cannot generate fixes`);
	}

	// Filter to valid FixGeneratorIds
	const validCheckIds = checkIds.filter((id) => {
		if (validIds.has(id)) return true;
		log.warn("Skipping unsupported checkId", { checkId: id });
		return false;
	}) as FixGeneratorId[];

	const client = ClaudeClient.fromEnv();
	const fixes: Record<string, ValidatedGeneratedFix> = {};
	const processedCheckIds = new Set<string>();
	const successfulCheckIds = new Set<string>();

	try {
		for (const checkId of validCheckIds) {
			// Skip if scan doesn't have a matching check result
			const checks = (scan.checks ?? []) as Array<{
				id: string;
				name: string;
				status: string;
				category: string;
				severity: string;
				score: number;
				summary: string;
				issues: unknown[];
			}>;
			const check = checks.find((c) => c.id === checkId);
			if (!check) {
				log.warn("Skipping checkId — no matching check in scan results", { checkId });
				continue;
			}

			// Set per-check status to processing
			await scanQueries.updateFixCheckStatus(db, scanId, checkId, {
				status: "processing",
				startedAt: new Date().toISOString(),
			});

			const ctx: FixGeneratorContext = {
				url: scan.url,
				html: scan.htmlContent,
				check: check as FixGeneratorContext["check"],
			};

			try {
				const result = await generateFix(checkId, ctx, client);
				if (result.ok) {
					fixes[checkId] = result.data;
					processedCheckIds.add(checkId);
					successfulCheckIds.add(checkId);
					// Don't mark completed yet — wait until mergeScanFixes persists content
				} else {
					processedCheckIds.add(checkId);
					await scanQueries.updateFixCheckStatus(db, scanId, checkId, {
						status: "failed",
						error: result.error.message,
					});
					log.warn("Fix generation failed for check", {
						checkId,
						error: result.error.message,
					});
				}
			} catch (err) {
				processedCheckIds.add(checkId);
				await scanQueries.updateFixCheckStatus(db, scanId, checkId, {
					status: "failed",
					error: err instanceof Error ? err.message : "Unknown error",
				});
				log.warn("Fix generation threw for check", { checkId });
			}
		}
	} catch (err) {
		// Unexpected error — mark remaining unprocessed AND successful-but-unpersisted checks as failed on last attempt
		if (isLastAttempt(job)) {
			const message = err instanceof Error ? err.message : "Unknown error";
			for (const checkId of validCheckIds) {
				if (!processedCheckIds.has(checkId) || successfulCheckIds.has(checkId)) {
					await scanQueries.updateFixCheckStatus(db, scanId, checkId, {
						status: "failed",
						error: message,
					});
				}
			}
		}
		throw err;
	}

	const generatedCount = Object.keys(fixes).length;

	if (generatedCount > 0) {
		try {
			await mergeScanFixes(db, scanId, fixes);
		} catch (err) {
			// Content persist failed — handle based on attempt number
			if (isLastAttempt(job)) {
				const message = err instanceof Error ? err.message : "Unknown error";
				for (const checkId of successfulCheckIds) {
					await scanQueries.updateFixCheckStatus(db, scanId, checkId, {
						status: "failed",
						error: `mergeScanFixes failed: ${message}`,
					});
				}
			}
			// Non-final: leave as processing so retry re-processes
			throw err;
		}
	}

	// Mark successful checks as completed only after content is persisted
	for (const checkId of successfulCheckIds) {
		await scanQueries.updateFixCheckStatus(db, scanId, checkId, {
			status: "completed",
			completedAt: new Date().toISOString(),
		});
	}

	log.info("Fix generation completed", { generatedCount });

	return { scanId, generatedCount };
}
