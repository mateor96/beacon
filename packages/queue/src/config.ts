import type { QueueName } from "./types.js";

/**
 * Queue retry policy — see docs/queue-retry-policy.md for full details.
 *
 * - **scan**: 3 attempts / 2 s exponential — external HTTP fetches are flaky, cheap to retry.
 * - **fix**: 2 attempts / 5 s exponential — Claude API costs money, rate-limit-aware.
 * - **report**: 2 attempts / 5 s exponential — memory-heavy PDF, OOM risk with many retries.
 * - **analysis**: 2 attempts / 5 s exponential — same Claude API cost logic as fix.
 * - **llms-txt**: 2 attempts / 5 s exponential — Claude API costs money, rate-limit-aware (mirrors fix).
 * - **json-ld**: 2 attempts / 5 s exponential — Claude API costs money, rate-limit-aware (mirrors llms-txt).
 * - **agents-md**: 2 attempts / 5 s exponential — Claude API costs money, rate-limit-aware (mirrors llms-txt).
 * - **deploy**: 2 attempts / 5 s exponential — CMS writes are idempotent, safe to retry on transient failures.
 *
 * After all retries are exhausted the job is captured in the `dead_letter_jobs` table
 * and a structured alert is emitted to stderr.
 * Retention cleanup (recommended 30 days) is not yet scheduled — see docs/queue-retry-policy.md.
 */
export const QUEUE_NAMES = [
	"scan",
	"fix",
	"report",
	"analysis",
	"email",
	"public-audit",
	"ai-visibility",
	"llms-txt",
	"json-ld",
	"agents-md",
	"roi-report",
	"rollback",
	"deploy",
	"validate-deployment",
	"citation-extraction",
	"csv-export",
	"webhook-delivery",
	"crawl",
] as const satisfies readonly QueueName[];

export const QUEUE_PREFIX = "beacon";

export interface QueueConfig {
	concurrency: number;
	limiter?: { max: number; duration: number };
	lockDuration?: number;
	defaultJobOptions: {
		attempts: number;
		backoff: { type: "exponential"; delay: number };
		removeOnComplete: { age: number };
		removeOnFail: { age: number };
	};
}

export const QUEUE_CONFIG: Record<QueueName, QueueConfig> = {
	scan: {
		concurrency: 5,
		defaultJobOptions: {
			attempts: 3,
			backoff: { type: "exponential", delay: 2_000 },
			removeOnComplete: { age: 3_600 },
			removeOnFail: { age: 86_400 },
		},
	},
	fix: {
		concurrency: 3,
		limiter: { max: 10, duration: 60_000 },
		lockDuration: 60_000,
		defaultJobOptions: {
			attempts: 2,
			backoff: { type: "exponential", delay: 5_000 },
			removeOnComplete: { age: 3_600 },
			removeOnFail: { age: 86_400 },
		},
	},
	report: {
		concurrency: 2,
		lockDuration: 120_000,
		defaultJobOptions: {
			attempts: 2,
			backoff: { type: "exponential", delay: 5_000 },
			removeOnComplete: { age: 3_600 },
			removeOnFail: { age: 86_400 },
		},
	},
	analysis: {
		concurrency: 3,
		limiter: { max: 10, duration: 60_000 },
		lockDuration: 60_000,
		defaultJobOptions: {
			attempts: 2,
			backoff: { type: "exponential", delay: 5_000 },
			removeOnComplete: { age: 3_600 },
			removeOnFail: { age: 86_400 },
		},
	},
	email: {
		concurrency: 5,
		limiter: { max: 50, duration: 60_000 },
		defaultJobOptions: {
			attempts: 3,
			backoff: { type: "exponential", delay: 3_000 },
			removeOnComplete: { age: 86_400 },
			removeOnFail: { age: 604_800 },
		},
	},
	"public-audit": {
		concurrency: 3,
		defaultJobOptions: {
			attempts: 3,
			backoff: { type: "exponential", delay: 2_000 },
			removeOnComplete: { age: 3_600 },
			removeOnFail: { age: 86_400 },
		},
	},
	"ai-visibility": {
		concurrency: 2,
		limiter: { max: 8, duration: 60_000 },
		lockDuration: 120_000,
		defaultJobOptions: {
			attempts: 3,
			backoff: { type: "exponential", delay: 5_000 },
			removeOnComplete: { age: 3_600 },
			removeOnFail: { age: 86_400 },
		},
	},
	"llms-txt": {
		concurrency: 3,
		limiter: { max: 10, duration: 60_000 },
		lockDuration: 60_000,
		defaultJobOptions: {
			attempts: 2,
			backoff: { type: "exponential", delay: 5_000 },
			removeOnComplete: { age: 3_600 },
			removeOnFail: { age: 86_400 },
		},
	},
	"json-ld": {
		concurrency: 3,
		limiter: { max: 10, duration: 60_000 },
		lockDuration: 60_000,
		defaultJobOptions: {
			attempts: 2,
			backoff: { type: "exponential", delay: 5_000 },
			removeOnComplete: { age: 3_600 },
			removeOnFail: { age: 86_400 },
		},
	},
	"agents-md": {
		concurrency: 3,
		limiter: { max: 10, duration: 60_000 },
		lockDuration: 60_000,
		defaultJobOptions: {
			attempts: 2,
			backoff: { type: "exponential", delay: 5_000 },
			removeOnComplete: { age: 3_600 },
			removeOnFail: { age: 86_400 },
		},
	},
	"roi-report": {
		concurrency: 2,
		lockDuration: 120_000,
		defaultJobOptions: {
			attempts: 2,
			backoff: { type: "exponential", delay: 5_000 },
			removeOnComplete: { age: 3_600 },
			removeOnFail: { age: 86_400 },
		},
	},
	rollback: {
		concurrency: 2,
		lockDuration: 60_000,
		defaultJobOptions: {
			attempts: 2,
			backoff: { type: "exponential", delay: 5_000 },
			removeOnComplete: { age: 3_600 },
			removeOnFail: { age: 86_400 },
		},
	},
	deploy: {
		concurrency: 2,
		lockDuration: 120_000,
		defaultJobOptions: {
			attempts: 2,
			backoff: { type: "exponential", delay: 5_000 },
			removeOnComplete: { age: 3_600 },
			removeOnFail: { age: 86_400 },
		},
	},
	"validate-deployment": {
		concurrency: 3,
		defaultJobOptions: {
			attempts: 3,
			backoff: { type: "exponential", delay: 300_000 },
			removeOnComplete: { age: 86_400 },
			removeOnFail: { age: 604_800 },
		},
	},
	"citation-extraction": {
		concurrency: 4,
		defaultJobOptions: {
			attempts: 3,
			backoff: { type: "exponential", delay: 2_000 },
			removeOnComplete: { age: 3_600 },
			removeOnFail: { age: 86_400 },
		},
	},
	"csv-export": {
		concurrency: 2,
		lockDuration: 600_000, // exports can be slow (large datasets)
		defaultJobOptions: {
			attempts: 2,
			backoff: { type: "exponential", delay: 10_000 },
			removeOnComplete: { age: 86_400 },
			removeOnFail: { age: 604_800 },
		},
	},
	"webhook-delivery": {
		concurrency: 5,
		// 5 attempts with exponential backoff: 2s, 4s, 8s, 16s, 32s.
		// After the 5th attempt the job is dead-lettered and the
		// delivery row is marked "dead_letter". Long retention so
		// operators can inspect delivery failures post-mortem.
		defaultJobOptions: {
			attempts: 5,
			backoff: { type: "exponential", delay: 2_000 },
			removeOnComplete: { age: 86_400 },
			removeOnFail: { age: 604_800 },
		},
	},
	crawl: {
		concurrency: 1, // one crawl at a time per host — politeness
		lockDuration: 600_000, // crawls can take minutes
		defaultJobOptions: {
			attempts: 2,
			backoff: { type: "exponential", delay: 30_000 },
			removeOnComplete: { age: 86_400 },
			removeOnFail: { age: 604_800 },
		},
	},
};
