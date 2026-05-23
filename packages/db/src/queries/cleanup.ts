import { unlink } from "node:fs/promises";
import path from "node:path";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import { scans } from "../schema/scans";

const REPORT_STORAGE_PATH = process.env.REPORT_STORAGE_PATH ?? "/tmp/reports";

export interface CleanupResult {
	deletedCount: number;
	filesDeleted: number;
	batchesRun: number;
}

/**
 * Delete scans where expiresAt <= now, in batches.
 * Also removes associated PDF report files from the filesystem.
 */
export async function deleteExpiredScans(
	db: DbClient,
	opts: { batchSize?: number; maxBatches?: number } = {},
): Promise<CleanupResult> {
	const { batchSize = 500, maxBatches = 100 } = opts;
	let deletedCount = 0;
	let filesDeleted = 0;
	let batchesRun = 0;

	const now = new Date();

	while (batchesRun < maxBatches) {
		const batch = await db
			.delete(scans)
			.where(
				and(
					lte(scans.expiresAt, now),
					sql`${scans.id} IN (
						SELECT id FROM scans
						WHERE ${scans.expiresAt} <= ${now}
						LIMIT ${batchSize}
					)`,
				),
			)
			.returning({ id: scans.id });

		batchesRun++;
		deletedCount += batch.length;

		// Clean up PDF files for deleted scans
		for (const row of batch) {
			try {
				await unlink(path.join(REPORT_STORAGE_PATH, `${row.id}.pdf`));
				filesDeleted++;
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
					console.warn(`Failed to delete report PDF for scan ${row.id}:`, err);
				}
			}
		}

		if (batch.length < batchSize) {
			break;
		}
	}

	return { deletedCount, filesDeleted, batchesRun };
}

/**
 * Set expiresAt for all scans of a user based on retention days.
 * Used to backfill existing scans when a user changes plan.
 */
export async function setExpiresAtForScans(
	db: DbClient,
	userId: string,
	retentionDays: number,
): Promise<number> {
	const result = await db
		.update(scans)
		.set({
			expiresAt: sql`${scans.scannedAt} + interval '${sql.raw(String(retentionDays))} days'`,
		})
		.where(eq(scans.userId, userId))
		.returning({ id: scans.id });

	return result.length;
}

// ── HTML Content TTL ────────────────────────────────────────

export interface HtmlPurgeResult {
	purgedCount: number;
	batchesRun: number;
}

/**
 * Find scans whose htmlContent has expired and is still present.
 * Returns only scan IDs — lightweight for the worker to iterate.
 */
export async function findExpiredHtmlContent(
	db: DbClient,
	opts: { limit?: number } = {},
): Promise<{ id: string }[]> {
	const { limit = 1000 } = opts;
	const now = new Date();

	return db
		.select({ id: scans.id })
		.from(scans)
		.where(and(lte(scans.htmlContentExpiresAt, now), isNotNull(scans.htmlContent)))
		.limit(limit);
}

/**
 * Set htmlContent = NULL for scans where htmlContentExpiresAt has passed.
 * Does NOT delete rows — only clears the heavy text column.
 * Batched to avoid long-running transactions.
 */
export async function purgeExpiredHtmlContent(
	db: DbClient,
	opts: { batchSize?: number; maxBatches?: number } = {},
): Promise<HtmlPurgeResult> {
	const { batchSize = 500, maxBatches = 100 } = opts;
	let purgedCount = 0;
	let batchesRun = 0;

	const now = new Date();

	while (batchesRun < maxBatches) {
		const batch = await db
			.update(scans)
			.set({ htmlContent: null })
			.where(
				and(
					lte(scans.htmlContentExpiresAt, now),
					isNotNull(scans.htmlContent),
					sql`${scans.id} IN (
						SELECT id FROM scans
						WHERE ${scans.htmlContentExpiresAt} <= ${now}
							AND ${scans.htmlContent} IS NOT NULL
						LIMIT ${batchSize}
					)`,
				),
			)
			.returning({ id: scans.id });

		batchesRun++;
		purgedCount += batch.length;

		if (batch.length < batchSize) {
			break;
		}
	}

	return { purgedCount, batchesRun };
}
