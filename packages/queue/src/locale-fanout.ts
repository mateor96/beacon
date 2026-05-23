import type { JobsOptions } from "bullmq";
import { addJob } from "./client.js";
import type { ScanJobData, ScanJobResult } from "./types.js";

export interface LocaleScanTarget {
	scanId: string;
	url: string;
	localeId: string;
	isPrimary: boolean;
}

/**
 * Enqueues one scan job per locale, with the primary locale getting a higher
 * BullMQ priority (lower number = higher). Failures in one locale are isolated
 * because each job has its own ID and retry policy.
 *
 * Returns the list of jobs created (caller can track them by id).
 *
 * Idempotency: callers must supply per-locale unique scanIds; we further
 * scope the BullMQ jobId with `scan:locale:<scanId>:<localeId>` so retrying
 * the fan-out doesn't double-enqueue.
 */
export async function enqueueLocaleScans(targets: LocaleScanTarget[], opts?: JobsOptions) {
	const jobs = [];
	for (const t of targets) {
		const data: ScanJobData = { scanId: t.scanId, url: t.url, localeId: t.localeId };
		const jobOpts: JobsOptions = {
			...opts,
			jobId: opts?.jobId ?? `scan:locale:${t.scanId}:${t.localeId}`,
			priority: t.isPrimary ? 1 : 10,
		};
		const job = await addJob("scan", data, jobOpts);
		jobs.push({
			id: job.id,
			localeId: t.localeId,
			isPrimary: t.isPrimary,
		} satisfies { id: string | undefined; localeId: string; isPrimary: boolean });
	}
	return jobs as Array<{ id: string | undefined; localeId: string; isPrimary: boolean }>;
}

/**
 * Pure helper (no I/O) — sorts targets so primary locales come first.
 * Exposed for callers that want to render the order in UI/logs without
 * actually enqueuing yet.
 */
export function orderByPrimary<T extends { isPrimary: boolean }>(targets: T[]): T[] {
	return [...targets].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}
