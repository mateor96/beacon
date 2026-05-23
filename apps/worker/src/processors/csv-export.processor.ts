import { csvExportQueries, db } from "@beacon/db";
import type { CsvExportJobData, CsvExportJobResult } from "@beacon/queue";
import type { Job } from "bullmq";
import { buildCsv } from "../lib/csv-export/exporters.js";
import { buildCsvExportStorage } from "../lib/csv-export/storage.js";
import { createJobLogger } from "../lib/logger.js";

/**
 * BullMQ processor for the `csv-export` job (#225).
 *
 * Flow:
 *  1. Load export row, mark processing + startedAt
 *  2. buildCsv (streams rows through the entity-specific exporter)
 *  3. Upload to storage, capture signed URL + expiry
 *  4. Mark completed with row count + file bytes + downloadUrl
 *  On any failure: mark failed with the error message (no re-throw for
 *  non-transient issues — BullMQ retry is driven by thrown exceptions).
 */
export async function processCsvExport(
	job: Job<CsvExportJobData, CsvExportJobResult>,
): Promise<CsvExportJobResult> {
	const { exportId } = job.data;
	const log = createJobLogger({
		queue: "csv-export",
		jobId: job.id ?? "unknown",
		scanId: exportId,
	});

	const exp = await csvExportQueries.getById(db, exportId);
	if (!exp) throw new Error(`csv_export ${exportId} not found`);

	await csvExportQueries.updateStatus(db, exportId, "processing", {
		progress: 5,
		startedAt: new Date(),
	});

	try {
		const bytes = await buildCsv({
			exportId,
			userId: exp.userId,
			entity: exp.entity,
			columns: exp.columns ?? null,
			dateFrom: exp.dateFrom,
			dateTo: exp.dateTo,
			onProgress: async (progress, rowCount) => {
				await csvExportQueries.updateStatus(db, exportId, "processing", {
					progress,
					rowCount,
				});
			},
		});

		const storage = buildCsvExportStorage();
		const storageKey = `exports/${exp.userId}/${exportId}.csv`;
		const put = await storage.put(storageKey, bytes, { ttlSeconds: 24 * 60 * 60 });

		await csvExportQueries.updateStatus(db, exportId, "completed", {
			progress: 100,
			rowCount: exp.rowCount, // persisted by buildCsv already
			fileBytes: put.bytes,
			storageKey: put.key,
			downloadUrl: put.url,
			urlExpiresAt: put.urlExpiresAt,
			completedAt: new Date(),
		});

		log.info("CSV export completed", { exportId, bytes: put.bytes });
		return { exportId, rowCount: exp.rowCount, fileBytes: put.bytes };
	} catch (err) {
		log.error("CSV export failed", err);
		await csvExportQueries.updateStatus(db, exportId, "failed", {
			errorMessage: err instanceof Error ? err.message : "unknown error",
			completedAt: new Date(),
		});
		throw err;
	}
}
