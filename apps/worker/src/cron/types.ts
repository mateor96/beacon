export type CronShortcut = "@daily" | "@weekly" | "@monthly" | "@hourly";

export interface CronJobDefinition {
	/** Stable identifier used as BullMQ scheduler ID. Must be unique. */
	name: string;
	/** 5-field cron expression or shortcut (@daily, @weekly, @monthly, @hourly). */
	pattern: string | CronShortcut;
	/** Handler returns structured data logged on success. */
	handler: () => Promise<Record<string, unknown>>;
	/** Override default retry (default: 3 attempts, 2s exponential). */
	retry?: {
		attempts?: number;
		backoff?: { type: "exponential"; delay: number };
	};
	/** Human-readable description for health endpoint. */
	description?: string;
}

export interface CronHealthEntry {
	name: string;
	pattern: string;
	description: string | undefined;
	lastRun: string | null;
	lastDurationMs: number | null;
	lastStatus: "success" | "failed" | null;
	lastError: string | null;
	nextRun: string | null;
}

export interface CronExecutionRecord {
	timestamp: string;
	durationMs: number;
	status: "success" | "failed";
	error?: string;
}
