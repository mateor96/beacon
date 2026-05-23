import { QUEUE_PREFIX, getConnectionOptions } from "@beacon/queue";
import { Queue, Worker } from "bullmq";
import { insertDlqWithRetry } from "../lib/dlq.js";
import { createSystemLogger } from "../lib/logger.js";
import type { CronExecutionRecord, CronHealthEntry, CronJobDefinition } from "./types.js";

const log = createSystemLogger({ service: "worker", component: "cron" });

const CRON_QUEUE_NAME = "cron";
const CRON_CONCURRENCY = 1;

const SHORTCUT_MAP: Record<string, string> = {
	"@daily": "0 0 * * *",
	"@weekly": "0 0 * * 0",
	"@monthly": "0 0 1 * *",
	"@hourly": "0 * * * *",
};

const DEFAULT_RETRY = {
	attempts: 3,
	backoff: { type: "exponential" as const, delay: 2_000 },
};

export class CronRegistry {
	private definitions = new Map<string, CronJobDefinition>();
	private executions = new Map<string, CronExecutionRecord>();
	private queue: Queue | null = null;
	private worker: Worker | null = null;

	/** Register a cron job definition. Must be called before start(). */
	register(def: CronJobDefinition): void {
		if (this.worker) throw new Error("Cannot register after start()");
		if (this.definitions.has(def.name)) throw new Error(`Duplicate cron job name: ${def.name}`);
		// Resolve shortcuts
		const resolved = SHORTCUT_MAP[def.pattern] ?? def.pattern;
		this.definitions.set(def.name, { ...def, pattern: resolved });
	}

	/** Start the cron queue, worker, and upsert all schedulers. */
	async start(): Promise<void> {
		if (this.definitions.size === 0) {
			log.warn("No cron jobs registered, skipping start");
			return;
		}

		const connection = getConnectionOptions();

		this.queue = new Queue(CRON_QUEUE_NAME, {
			connection,
			prefix: QUEUE_PREFIX,
		});

		// Upsert schedulers
		for (const [name, def] of this.definitions) {
			const retry = { ...DEFAULT_RETRY, ...def.retry };
			await this.queue.upsertJobScheduler(
				name,
				{ pattern: def.pattern as string },
				{
					name,
					opts: {
						attempts: retry.attempts,
						backoff: retry.backoff,
						removeOnComplete: { age: 3_600 },
						removeOnFail: { age: 86_400 },
					},
				},
			);
			log.info("Upserted cron scheduler", { name, pattern: def.pattern });
		}

		// Clean up stale schedulers (removed from code between deploys)
		const existing = await this.queue.getJobSchedulers();
		for (const scheduler of existing) {
			if (!this.definitions.has(scheduler.name)) {
				await this.queue.removeJobScheduler(scheduler.name);
				log.info("Removed stale cron scheduler", { name: scheduler.name });
			}
		}

		// Create worker
		this.worker = new Worker(
			CRON_QUEUE_NAME,
			async (job) => {
				const def = this.definitions.get(job.name);
				if (!def) {
					log.warn("Unknown cron job, skipping", { name: job.name });
					return;
				}

				const startTime = Date.now();
				log.info("Cron job started", { name: job.name });

				try {
					const result = await def.handler();
					const durationMs = Date.now() - startTime;
					this.executions.set(job.name, {
						timestamp: new Date().toISOString(),
						durationMs,
						status: "success",
					});
					log.info("Cron job completed", { name: job.name, durationMs, ...result });
				} catch (err) {
					const durationMs = Date.now() - startTime;
					this.executions.set(job.name, {
						timestamp: new Date().toISOString(),
						durationMs,
						status: "failed",
						error: err instanceof Error ? err.message : String(err),
					});
					log.error("Cron job failed", err, { name: job.name, durationMs });
					throw err; // Re-throw so BullMQ handles retry/DLQ
				}
			},
			{
				connection,
				prefix: QUEUE_PREFIX,
				concurrency: CRON_CONCURRENCY,
			},
		);

		// DLQ handler for terminal cron failures
		this.worker.on("failed", (job, err) => {
			if (!job) return;
			const maxAttempts = job.opts.attempts ?? 1;
			const isTerminal = job.attemptsMade >= maxAttempts;

			if (isTerminal) {
				log.error("Cron job terminally failed", err, {
					name: job.name,
					attemptsMade: job.attemptsMade,
				});
				insertDlqWithRetry({
					queue: `cron:${job.name}`,
					jobId: job.id ?? "unknown",
					jobData: job.data,
					errorMessage: err.message,
					errorStack: err.stack ?? null,
					attemptsMade: job.attemptsMade,
					maxAttempts,
				});
			}
		});

		this.worker.on("error", (err) => {
			log.error("Cron worker error", err);
		});

		log.info("Cron registry started", {
			jobs: [...this.definitions.keys()],
			count: this.definitions.size,
		});
	}

	/** Stop the cron worker and queue. */
	async stop(force = false): Promise<void> {
		if (this.worker) {
			await this.worker.close(force);
			this.worker = null;
		}
		if (this.queue) {
			await this.queue.close();
			this.queue = null;
		}
		log.info("Cron registry stopped", { force });
	}

	/** Get health status of all registered cron jobs. */
	async getHealth(): Promise<CronHealthEntry[]> {
		const schedulers = this.queue ? await this.queue.getJobSchedulers() : [];
		const schedulerMap = new Map(schedulers.map((s) => [s.name, s]));

		const entries: CronHealthEntry[] = [];
		for (const [name, def] of this.definitions) {
			const exec = this.executions.get(name);
			const scheduler = schedulerMap.get(name);

			entries.push({
				name,
				pattern: def.pattern as string,
				description: def.description,
				lastRun: exec?.timestamp ?? null,
				lastDurationMs: exec?.durationMs ?? null,
				lastStatus: exec?.status ?? null,
				lastError: exec?.error ?? null,
				nextRun: scheduler?.next ? new Date(scheduler.next).toISOString() : null,
			});
		}
		return entries;
	}
}
