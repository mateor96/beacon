/**
 * ROI report generation processor (#281).
 *
 * Assembles score snapshots, milestones, and citations for a monitoring
 * project, generates AI recommendations via Claude, renders an HTML/PDF
 * report, and stores the result.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ClaudeClient, generateRoiReportTexts } from "@beacon/ai";
import type { RoiReportTextInput } from "@beacon/ai";
import { db, monitoringQueries, profileQueries, roiQueries } from "@beacon/db";
import type { RoiReportJobData, RoiReportJobResult } from "@beacon/queue";
import { renderPdf, renderRoiHtml } from "@beacon/report";
import type { RoiReportInput } from "@beacon/report";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";

const REPORT_STORAGE_PATH = process.env.REPORT_STORAGE_PATH ?? "/tmp/reports";

export async function processRoiReport(
	job: Job<RoiReportJobData, RoiReportJobResult>,
): Promise<RoiReportJobResult> {
	const { projectId, branding } = job.data;
	const log = createJobLogger({
		queue: "roi-report",
		jobId: job.id ?? "unknown",
		scanId: projectId,
	});

	log.info("Starting ROI report generation", { projectId });

	// 1. Fetch baseline + latest snapshots
	const [baseline, latest, allSnapshots, milestones, citations] = await Promise.all([
		roiQueries.getBaselineSnapshot(db, projectId),
		roiQueries.getLatestSnapshot(db, projectId),
		roiQueries.getSnapshotsForProject(db, projectId),
		roiQueries.getMilestonesForProject(db, projectId),
		roiQueries.getCitationsForProject(db, projectId),
	]);

	if (!baseline) {
		throw new Error(`No baseline snapshot found for project ${projectId}`);
	}
	if (!latest) {
		throw new Error(`No snapshots found for project ${projectId}`);
	}

	// 2. Compute deltas
	const scoreDelta = latest.overallScore - baseline.overallScore;
	const subScoreDeltas = {
		readability: (latest.subScores.readability ?? 0) - (baseline.subScores.readability ?? 0),
		interactivity: (latest.subScores.interactivity ?? 0) - (baseline.subScores.interactivity ?? 0),
		transactional: (latest.subScores.transactional ?? 0) - (baseline.subScores.transactional ?? 0),
	};
	const citationDelta = latest.aiCitationCount - baseline.aiCitationCount;

	// 3. Build citation changes per platform (before=0, after=current count for MVP)
	const citationChanges = citations.map((c) => ({
		platform: c.platform,
		before: 0,
		after: c.count,
	}));

	// 4. Generate AI recommendations
	let aiTexts: RoiReportInput["aiTexts"];
	try {
		const client = ClaudeClient.fromEnv();
		const aiInput: RoiReportTextInput = {
			url: baseline.projectId, // Will be resolved below
			currentScore: latest.overallScore,
			baselineScore: baseline.overallScore,
			scoreDelta,
			readinessLevel: latest.readinessLevel as 0 | 1 | 2 | 3,
			levelScores: latest.subScores,
			subScoreDeltas,
			milestones: milestones.map((m) => ({
				type: m.milestoneType,
				description: (m.milestoneData as { description?: string }).description ?? m.milestoneType,
			})),
			citationCount: latest.aiCitationCount,
			citationDelta,
			daysSinceBaseline: Math.floor(
				(latest.createdAt.getTime() - baseline.createdAt.getTime()) / (1000 * 60 * 60 * 24),
			),
			failingChecks: [], // Not available from snapshots; would need scan data
		};

		const result = await generateRoiReportTexts(aiInput, client);
		if (result.ok) {
			aiTexts = result.data;
			log.info("AI recommendations generated", {
				recommendations: result.data.recommendations.length,
			});
		} else {
			log.warn("AI recommendations failed, generating report without", {
				error: result.error.message,
			});
		}
	} catch (aiErr) {
		log.warn("AI recommendations error, continuing without", {
			error: aiErr instanceof Error ? aiErr.message : String(aiErr),
		});
	}

	// 5. Assemble report input
	const reportInput: RoiReportInput = {
		projectName: projectId, // Ideally resolved from monitoring_projects.name
		websiteUrl: "",
		periodStart: baseline.createdAt.toISOString(),
		periodEnd: latest.createdAt.toISOString(),
		baselineScore: baseline.overallScore,
		currentScore: latest.overallScore,
		scoreDelta,
		baselineLevel: baseline.readinessLevel,
		currentLevel: latest.readinessLevel,
		subScoresBefore: baseline.subScores,
		subScoresAfter: latest.subScores,
		snapshots: allSnapshots.map((s) => ({
			date: s.createdAt.toISOString(),
			overallScore: s.overallScore,
		})),
		citationChanges,
		milestones: milestones.map((m) => ({
			milestoneType: m.milestoneType,
			description: (m.milestoneData as { description?: string }).description ?? m.milestoneType,
			triggeredAt: m.triggeredAt.toISOString(),
		})),
		aiTexts,
		branding,
	};

	// 6. Render HTML
	const html = renderRoiHtml(reportInput);

	// 7. Render PDF
	const pdfResult = await renderPdf(html);

	// 8. Store report
	const reportRow = await roiQueries.createRoiReport(db, {
		projectId,
		baselineSnapshotId: baseline.id,
		latestSnapshotId: latest.id,
		reportData: {
			scoreDelta,
			citationDelta,
			improvements: [
				{
					checkId: "readability",
					before: baseline.subScores.readability ?? 0,
					after: latest.subScores.readability ?? 0,
				},
				{
					checkId: "interactivity",
					before: baseline.subScores.interactivity ?? 0,
					after: latest.subScores.interactivity ?? 0,
				},
				{
					checkId: "transactional",
					before: baseline.subScores.transactional ?? 0,
					after: latest.subScores.transactional ?? 0,
				},
			],
			generatedAt: new Date().toISOString(),
			subScoreDeltas,
			citationChanges,
			milestones: milestones.map((m) => ({
				type: m.milestoneType,
				description: (m.milestoneData as { description?: string }).description ?? "",
				triggeredAt: m.triggeredAt.toISOString(),
			})),
			aiRecommendations: aiTexts,
		},
		format: "pdf",
	});

	if (!reportRow) {
		throw new Error("Failed to insert ROI report row");
	}

	// 9. Write PDF + HTML to filesystem
	await mkdir(REPORT_STORAGE_PATH, { recursive: true });
	const filePath = path.join(REPORT_STORAGE_PATH, `roi-${reportRow.id}.pdf`);
	const htmlPath = path.join(REPORT_STORAGE_PATH, `roi-${reportRow.id}.html`);
	await Promise.all([writeFile(filePath, pdfResult.pdf), writeFile(htmlPath, html)]);

	log.info("ROI report generated", {
		reportId: reportRow.id,
		fileSizeBytes: pdfResult.pdf.byteLength,
		pageCount: pdfResult.pageCount,
	});

	// ROI report-ready notification was per-user via the archived auth layer.
	// In single-tenant OSS mode the operator-email pathway is rebuilt in
	// #13 (ROI report UI trigger + email integration).

	return {
		reportId: reportRow.id,
		projectId,
		generatedAt: new Date().toISOString(),
		fileSizeBytes: pdfResult.pdf.byteLength,
	};
}
