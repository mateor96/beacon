import { ClaudeClient, type LlmsCheckSummary, generateLlmsTxt } from "@beacon/ai";
import { db, scanQueries } from "@beacon/db";
import type { LlmsTxtJobData, LlmsTxtJobResult } from "@beacon/queue";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";

export async function processLlmsTxt(
	job: Job<LlmsTxtJobData, LlmsTxtJobResult>,
): Promise<LlmsTxtJobResult> {
	const { scanId, force } = job.data;
	const log = createJobLogger({ queue: "llms-txt", jobId: job.id ?? "unknown", scanId });

	log.info("Starting llms.txt generation", { force: Boolean(force) });

	const scan = await scanQueries.getById(db, scanId);
	if (!scan) {
		throw new Error(`Scan ${scanId} not found`);
	}
	if (!scan.htmlContent) {
		throw new Error(`Scan ${scanId} has no htmlContent`);
	}
	if (!scan.userId) {
		throw new Error(
			`Scan ${scanId} has no userId — anonymous scans are not supported for llms.txt generation`,
		);
	}

	const checks = (scan.checks ?? []) as LlmsCheckSummary[];
	const llmsCheck = checks.find((c) => c.id === "llms-txt");

	// Prefer the post-redirect URL when present (review P1 #5).
	const finalUrl = scan.finalUrl ?? scan.url;

	const client = ClaudeClient.fromEnv();
	const result = await generateLlmsTxt(
		{
			scanId,
			userId: scan.userId,
			finalUrl,
			htmlContent: scan.htmlContent,
			llmsCheck,
			force,
		},
		client,
		db,
	);

	log.info("llms.txt generation completed", {
		fixId: result.fixId,
		version: result.version,
		method: result.method,
		costCents: result.costCents,
	});

	return {
		scanId,
		fixId: result.fixId,
		version: result.version,
		method: result.method,
		costCents: result.costCents,
	};
}
