import { db, scanQueries } from "@beacon/db";

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const BATCH_LIMIT = 100;

export async function reapStaleScans(): Promise<{ reaped: number; compensated: number }> {
	const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);
	const staleScans = await scanQueries.findStaleScans(db, cutoff, BATCH_LIMIT);

	let reaped = 0;

	for (const scan of staleScans) {
		try {
			const updated = await scanQueries.markCompensated(db, scan.id);
			if (!updated) continue;
			reaped++;
		} catch (err) {
			console.error(`[reaper] Failed to reap scan ${scan.id}:`, err);
		}
	}

	// `compensated` was the count of scans whose quota was rolled back. In
	// the OSS build there are no quotas, so this is always 0 — kept in the
	// return shape so existing callers (and the cron metrics) don't break.
	return { reaped, compensated: 0 };
}
