import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ClaudeClient, generateReportTexts } from "@beacon/ai";
import type { ValidatedReportTexts } from "@beacon/ai";
import { db, scanQueries } from "@beacon/db";
import type { ReportJobData, ReportJobResult } from "@beacon/queue";
import { generateReport } from "@beacon/report";
import type { ScanResult } from "@beacon/shared";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";
import { flattenReportTexts } from "../lib/report-mapper.js";

const REPORT_STORAGE_PATH = process.env.REPORT_STORAGE_PATH ?? "/tmp/reports";

function isLastAttempt(job: Job): boolean {
	const maxAttempts = job.opts.attempts ?? 1;
	return job.attemptsMade >= maxAttempts - 1;
}

export async function processReport(
	job: Job<ReportJobData, ReportJobResult>,
): Promise<ReportJobResult> {
	const { scanId, branding } = job.data;
	const log = createJobLogger({ queue: "report", jobId: job.id ?? "unknown", scanId });

	log.info("Starting report generation");

	try {
		const scan = await scanQueries.getById(db, scanId);
		if (!scan) {
			throw new Error(`Scan ${scanId} not found`);
		}

		if (scan.status !== "completed") {
			throw new Error(`Scan ${scanId} is not completed (status: ${scan.status})`);
		}

		// Set status to processing
		await scanQueries.updateReportStatus(db, scanId, "processing", { jobId: job.id });
		// Get or generate report texts
		let reportTexts: ValidatedReportTexts;

		if (scan.reportTexts && !job.data.regenerate) {
			reportTexts = scan.reportTexts as unknown as ValidatedReportTexts;
		} else {
			const client = ClaudeClient.fromEnv();

			const scanResult: ScanResult = {
				id: scan.id,
				url: scan.url,
				finalUrl: scan.finalUrl ?? undefined,
				status: scan.status as ScanResult["status"],
				overallScore: scan.score ?? 0,
				readinessLevel: (scan.readinessLevel ?? 0) as ScanResult["readinessLevel"],
				levelScores: (scan.levelScores as ScanResult["levelScores"]) ?? {
					readability: null,
					interactivity: null,
					transactional: null,
				},
				checks: (scan.checks as ScanResult["checks"]) ?? [],
				createdAt: scan.scannedAt.toISOString(),
				completedAt: new Date().toISOString(),
			};

			const result = await generateReportTexts(scanResult, client);
			if (!result.ok) {
				throw new Error(`Report text generation failed: ${result.error.message}`);
			}

			reportTexts = result.data;
			await scanQueries.updateReportTexts(
				db,
				scanId,
				reportTexts as unknown as Record<string, unknown>,
			);
		}

		// Flatten rich ValidatedReportTexts → flat ReportTexts for the template
		const flatTexts = flattenReportTexts(reportTexts);

		// Generate PDF
		const reportOutput = await generateReport({
			url: scan.url,
			finalUrl: scan.finalUrl ?? undefined,
			scannedAt: scan.scannedAt.toISOString(),
			overallScore: scan.score ?? 0,
			readinessLevel: (scan.readinessLevel ?? 0) as Parameters<
				typeof generateReport
			>[0]["readinessLevel"],
			levelScores: (scan.levelScores as Parameters<typeof generateReport>[0]["levelScores"]) ?? {
				readability: null,
				interactivity: null,
				transactional: null,
			},
			checks: (scan.checks as Parameters<typeof generateReport>[0]["checks"]) ?? [],
			reportTexts: flatTexts,
			branding,
		});

		// Write PDF to filesystem
		await mkdir(REPORT_STORAGE_PATH, { recursive: true });
		const pdfPath = path.join(REPORT_STORAGE_PATH, `${scanId}.pdf`);
		await writeFile(pdfPath, reportOutput.pdf);

		// Set status to completed with ADR-009 metadata
		await scanQueries.updateReportStatus(db, scanId, "completed", {
			generatedAt: new Date(reportOutput.metadata.generatedAt),
			fileSizeBytes: reportOutput.metadata.fileSizeBytes,
		});

		log.info("Report generated", {
			fileSizeBytes: reportOutput.metadata.fileSizeBytes,
		});

		return {
			scanId,
			generatedAt: reportOutput.metadata.generatedAt,
			fileSizeBytes: reportOutput.metadata.fileSizeBytes,
		};
	} catch (err) {
		if (isLastAttempt(job)) {
			const message = err instanceof Error ? err.message : String(err);
			try {
				await scanQueries.updateReportStatus(db, scanId, "failed", { error: message });
			} catch (dbErr) {
				log.error("Failed to persist report failure status", dbErr);
			}
		}
		throw err;
	}
}
