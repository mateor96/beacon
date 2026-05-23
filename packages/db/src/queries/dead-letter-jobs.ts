import { count, desc, eq, lte, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import { deadLetterJobs } from "../schema/dead-letter-jobs";
import type { NewDeadLetterJob } from "../types";

/**
 * Dead-letter-job queries.
 * Recommended retention: 30 days. Call `deleteOlderThan` from a scheduled job (not yet wired).
 */

/** Insert a dead-letter entry. Uses onConflictDoNothing on (queue, jobId) for safe dedup. */
export async function insert(db: DbClient, data: NewDeadLetterJob): Promise<void> {
	await db
		.insert(deadLetterJobs)
		.values(data)
		.onConflictDoNothing({
			target: [deadLetterJobs.queue, deadLetterJobs.jobId],
		});
}

/** Get dead-letter entries for a specific queue, ordered by failedAt DESC. */
export async function getByQueue(
	db: DbClient,
	queue: string,
	opts: { limit?: number; offset?: number } = {},
) {
	const { limit = 50, offset = 0 } = opts;
	return db
		.select()
		.from(deadLetterJobs)
		.where(eq(deadLetterJobs.queue, queue))
		.orderBy(desc(deadLetterJobs.failedAt))
		.limit(limit)
		.offset(offset);
}

/** Get all dead-letter entries ordered by failedAt DESC. */
export async function getAll(db: DbClient, opts: { limit?: number; offset?: number } = {}) {
	const { limit = 50, offset = 0 } = opts;
	return db
		.select()
		.from(deadLetterJobs)
		.orderBy(desc(deadLetterJobs.failedAt))
		.limit(limit)
		.offset(offset);
}

/** Count dead-letter entries grouped by queue. */
export async function countByQueue(db: DbClient) {
	return db
		.select({ queue: deadLetterJobs.queue, count: sql<number>`count(*)::int` })
		.from(deadLetterJobs)
		.groupBy(deadLetterJobs.queue);
}

/** Delete dead-letter entries older than the given cutoff. Returns the number of deleted rows. */
export async function deleteOlderThan(db: DbClient, cutoff: Date): Promise<number> {
	const deleted = await db
		.delete(deadLetterJobs)
		.where(lte(deadLetterJobs.failedAt, cutoff))
		.returning({ id: deadLetterJobs.id });
	return deleted.length;
}
