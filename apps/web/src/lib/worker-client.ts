/**
 * Thin server-side client for the worker's internal admin endpoints.
 *
 * Most operator-status data (queue metrics, provider keys, DLQ, email log) is
 * read in-process via `@beacon/queue`/`@beacon/ai`/`@beacon/db`. The only datum
 * that lives solely in the worker process is per-cron last/next-run state, so
 * this client fetches it best-effort from `WORKER_INTERNAL_URL`. When the env
 * var is unset or the worker is unreachable, callers get `null` and render a
 * degraded panel — the status page never fails because of the worker.
 */

export interface CronHealthEntry {
	name: string;
	pattern: string;
	description?: string;
	lastRun: string | null;
	lastDurationMs: number | null;
	lastStatus: string | null;
	lastError: string | null;
	nextRun: string | null;
}

const DEFAULT_TIMEOUT_MS = 2500;

/**
 * Fetches cron-job health from the worker. Returns `null` when
 * `WORKER_INTERNAL_URL` is unset or the worker cannot be reached in time.
 */
export async function fetchCronHealth(): Promise<CronHealthEntry[] | null> {
	const base = process.env.WORKER_INTERNAL_URL;
	if (!base) return null;

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
	try {
		const res = await fetch(`${base.replace(/\/$/, "")}/api/admin/cron/health`, {
			signal: controller.signal,
			cache: "no-store",
		});
		if (!res.ok) return null;
		const body = (await res.json()) as { jobs?: CronHealthEntry[] };
		return body.jobs ?? [];
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}
