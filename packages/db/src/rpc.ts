import { sql } from "drizzle-orm";
import type { DbClient } from "./client";

export interface MergeScanFixesResult {
	merged: boolean;
	fix_count: number;
}

function assertResult<T>(result: unknown[], fnName: string): T {
	const row = result[0];
	if (!row) {
		throw new Error(`${fnName} returned no rows`);
	}
	return row as T;
}

/**
 * Atomically merges the provided fixes JSONB blob into scans.fixes for the
 * given scan id and returns the count of fixes now stored. Backed by the
 * `merge_scan_fixes` Postgres function seeded by `pnpm db:migrate`.
 */
export async function mergeScanFixes(
	db: DbClient,
	scanId: string,
	fixes: unknown,
): Promise<MergeScanFixesResult> {
	const result = await db.execute(
		sql`SELECT * FROM merge_scan_fixes(${scanId}::uuid, ${JSON.stringify(fixes)}::jsonb)`,
	);
	return assertResult<MergeScanFixesResult>(result, "merge_scan_fixes");
}
