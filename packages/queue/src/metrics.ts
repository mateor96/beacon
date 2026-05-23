import type { Queue } from "bullmq";
import { getQueues } from "./client.js";
import { QUEUE_NAMES } from "./config.js";
import type { QueueName } from "./types.js";

// ── Metrics Schema ──────────────────────────────────────────

/** Per-queue job counts from BullMQ. */
export interface QueueCounts {
	waiting: number;
	active: number;
	completed: number;
	failed: number;
	delayed: number;
	paused: number;
}

/** Metrics for a single queue, including error state. */
export interface QueueMetrics {
	name: QueueName;
	counts: QueueCounts;
	/** True when the queue's counts could not be read (Redis down, etc.). */
	error: boolean;
	/** Error message when error is true. */
	errorMessage?: string;
}

/** Aggregate metrics response for all queues. */
export interface AllQueueMetrics {
	queues: QueueMetrics[];
	/** ISO-8601 timestamp of when metrics were collected. */
	collectedAt: string;
	/** True when at least one queue had an error. */
	partial: boolean;
}

// ── Defaults ────────────────────────────────────────────────

const EMPTY_COUNTS: QueueCounts = {
	waiting: 0,
	active: 0,
	completed: 0,
	failed: 0,
	delayed: 0,
	paused: 0,
};

// ── Service ─────────────────────────────────────────────────

/**
 * Reads job counts from a single BullMQ queue.
 * Returns EMPTY_COUNTS with error flag on failure.
 */
async function readQueueCounts(queue: Queue, name: QueueName): Promise<QueueMetrics> {
	try {
		const counts = await queue.getJobCounts(
			"waiting",
			"active",
			"completed",
			"failed",
			"delayed",
			"paused",
		);
		return {
			name,
			counts: {
				waiting: counts.waiting ?? 0,
				active: counts.active ?? 0,
				completed: counts.completed ?? 0,
				failed: counts.failed ?? 0,
				delayed: counts.delayed ?? 0,
				paused: counts.paused ?? 0,
			},
			error: false,
		};
	} catch (err) {
		return {
			name,
			counts: { ...EMPTY_COUNTS },
			error: true,
			errorMessage: err instanceof Error ? err.message : "Unknown error",
		};
	}
}

/**
 * Collects metrics for all queues in parallel.
 * Gracefully handles partial failures: if one queue is unreachable,
 * the others still return valid counts.
 */
export async function getQueueMetrics(): Promise<AllQueueMetrics> {
	const queues = getQueues();

	const results = await Promise.all(QUEUE_NAMES.map((name) => readQueueCounts(queues[name], name)));

	return {
		queues: results,
		collectedAt: new Date().toISOString(),
		partial: results.some((r) => r.error),
	};
}

/**
 * Collects metrics for a single queue by name.
 */
export async function getSingleQueueMetrics(name: QueueName): Promise<QueueMetrics> {
	const queues = getQueues();
	return readQueueCounts(queues[name], name);
}
