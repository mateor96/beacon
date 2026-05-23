import type { PublicAuditJobData, PublicAuditJobResult } from "@beacon/queue";
import {
	CheckRegistry,
	FetchError,
	ScannerEngine,
	defaultRegistry,
	fetchUrl,
} from "@beacon/scanner";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";

// Build lightweight registry with only the 7 public-audit checks
const PUBLIC_AUDIT_CHECK_IDS: string[] = [
	"robots-txt",
	"llms-txt",
	"agents-md",
	"meta-tags",
	"schema-org",
	"sitemap-xml",
	"content-structure",
];

const publicAuditRegistry = new CheckRegistry();
for (const id of PUBLIC_AUDIT_CHECK_IDS) {
	const plugin = defaultRegistry.get(id as Parameters<typeof defaultRegistry.get>[0]);
	if (plugin) publicAuditRegistry.register(plugin);
}
const engine = new ScannerEngine(publicAuditRegistry);

function isLastAttempt(job: Job): boolean {
	const maxAttempts = job.opts.attempts ?? 1;
	return job.attemptsMade >= maxAttempts - 1;
}

export async function processPublicAudit(
	job: Job<PublicAuditJobData, PublicAuditJobResult>,
): Promise<PublicAuditJobResult> {
	const { requestId, url } = job.data;
	const log = createJobLogger({
		queue: "public-audit",
		jobId: job.id ?? "unknown",
		scanId: requestId,
	});

	log.info("Starting public audit", { url });

	try {
		const { db, publicAuditQueries } = await import("@beacon/db");

		// Verify request exists
		const request = await publicAuditQueries.getRequestById(db, requestId);
		if (!request) {
			throw new Error(`Public audit request ${requestId} not found`);
		}

		// Mark as processing
		await publicAuditQueries.updateRequestStatus(db, requestId, "processing");

		// Pre-fetch HTML
		let fetchResult: Awaited<ReturnType<typeof fetchUrl>>;
		try {
			fetchResult = await fetchUrl(url);
		} catch (err) {
			if (err instanceof FetchError) {
				log.warn("Site unreachable", { code: err.code, error: err.message });
				await publicAuditQueries.updateRequestStatus(db, requestId, "failed");
				return { requestId, overallScore: 0 };
			}
			throw err;
		}

		// Run checks
		const result = await engine.scan(url, { prefetchedResult: fetchResult });

		if (result.status === "failed") {
			throw new Error(`Scanner internal failure: ${result.error ?? "unknown"}`);
		}

		const score = result.overallScore;

		// Build modelScores from check results
		const modelScores = result.checks.map((check) => ({
			checkId: check.id,
			name: check.name,
			score: check.score,
			status: check.status,
			summary: check.summary,
		}));

		const passCount = result.checks.filter((c) => c.status === "pass").length;
		const totalCount = result.checks.length;

		// German summary text
		let summaryText: string;
		if (score >= 80) {
			summaryText = "Ihre Website ist gut fuer KI-Sichtbarkeit optimiert.";
		} else if (score >= 50) {
			summaryText = "Ihre Website hat Optimierungspotenzial fuer KI-Sichtbarkeit.";
		} else {
			summaryText = "Ihre Website ist fuer KI-Systeme kaum sichtbar.";
		}
		summaryText += ` Score: ${score}/100 (${passCount}/${totalCount} Checks bestanden).`;

		// Persist results
		await publicAuditQueries.createResult(db, {
			requestId,
			overallScore: score,
			modelScores,
			summary: summaryText,
			rawData: result,
		});

		await publicAuditQueries.updateRequestStatus(db, requestId, "completed");

		log.info("Public audit completed", { overallScore: score });

		return { requestId, overallScore: score };
	} catch (err) {
		if (isLastAttempt(job)) {
			try {
				const { db, publicAuditQueries } = await import("@beacon/db");
				await publicAuditQueries.updateRequestStatus(db, requestId, "failed");
			} catch (dbErr) {
				log.error("Failed to update request status to failed", dbErr);
			}
		}

		log.error("Public audit failed", err);
		throw err;
	}
}
