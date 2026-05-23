import {
	type AgentsMdCheckSummary,
	ClaudeClient,
	type RobotsTxtCheckSummary,
	generateAgentsMd,
} from "@beacon/ai";
import { db, scanQueries } from "@beacon/db";
import type { AgentsMdJobData, AgentsMdJobResult } from "@beacon/queue";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";

export async function processAgentsMd(
	job: Job<AgentsMdJobData, AgentsMdJobResult>,
): Promise<AgentsMdJobResult> {
	const { scanId, force } = job.data;
	const log = createJobLogger({ queue: "agents-md", jobId: job.id ?? "unknown", scanId });

	log.info("Starting AGENTS.md generation", { force: Boolean(force) });

	const scan = await scanQueries.getById(db, scanId);
	if (!scan) {
		throw new Error(`Scan ${scanId} not found`);
	}
	if (!scan.htmlContent) {
		throw new Error(`Scan ${scanId} has no htmlContent`);
	}
	if (!scan.userId) {
		throw new Error(
			`Scan ${scanId} has no userId — anonymous scans are not supported for AGENTS.md generation`,
		);
	}

	const checks = (scan.checks ?? []) as Array<AgentsMdCheckSummary | RobotsTxtCheckSummary>;
	const agentsMdCheck = checks.find((c) => c.id === "agents-md") as
		| AgentsMdCheckSummary
		| undefined;
	const robotsTxtCheck = checks.find((c) => c.id === "robots-txt") as
		| RobotsTxtCheckSummary
		| undefined;

	// Prefer the post-redirect URL when present (review P1 #5).
	const finalUrl = scan.finalUrl ?? scan.url;

	const client = ClaudeClient.fromEnv();
	const result = await generateAgentsMd(
		{
			scanId,
			userId: scan.userId,
			finalUrl,
			htmlContent: scan.htmlContent,
			agentsMdCheck,
			robotsTxtCheck,
			force,
		},
		client,
		db,
	);

	log.info("AGENTS.md generation completed", {
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
