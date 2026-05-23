import { ClaudeClient, type SchemaOrgCheckSummary, generateSchemaOrg } from "@beacon/ai";
import { db, scanQueries } from "@beacon/db";
import type { JsonLdJobData, JsonLdJobResult } from "@beacon/queue";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";

export async function processJsonLd(
	job: Job<JsonLdJobData, JsonLdJobResult>,
): Promise<JsonLdJobResult> {
	const { scanId, force } = job.data;
	const log = createJobLogger({ queue: "json-ld", jobId: job.id ?? "unknown", scanId });

	log.info("Starting JSON-LD generation", { force: Boolean(force) });

	const scan = await scanQueries.getById(db, scanId);
	if (!scan) {
		throw new Error(`Scan ${scanId} not found`);
	}
	if (!scan.htmlContent) {
		throw new Error(`Scan ${scanId} has no htmlContent`);
	}
	if (!scan.userId) {
		throw new Error(
			`Scan ${scanId} has no userId — anonymous scans are not supported for JSON-LD generation`,
		);
	}

	const checks = (scan.checks ?? []) as SchemaOrgCheckSummary[];
	const schemaOrgCheck = checks.find((c) => c.id === "schema-org");

	// Prefer the post-redirect URL when present (review P1 #5).
	const finalUrl = scan.finalUrl ?? scan.url;

	const client = ClaudeClient.fromEnv();
	const result = await generateSchemaOrg(
		{
			scanId,
			userId: scan.userId,
			finalUrl,
			htmlContent: scan.htmlContent,
			schemaOrgCheck,
			force,
		},
		client,
		db,
	);

	log.info("JSON-LD generation completed", {
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
