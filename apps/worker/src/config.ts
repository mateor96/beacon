export const config = {
	redis: {
		host: process.env.REDIS_HOST ?? "localhost",
		port: Number(process.env.REDIS_PORT ?? 6379),
		password: (() => {
			if (!process.env.REDIS_PASSWORD) {
				throw new Error("REDIS_PASSWORD environment variable is required");
			}
			return process.env.REDIS_PASSWORD;
		})(),
	},
	worker: {
		port: Number(process.env.WORKER_PORT ?? 3001),
		shutdownTimeoutMs: Number(process.env.WORKER_SHUTDOWN_TIMEOUT_MS ?? 25_000),
	},
	alert: {
		failureThreshold: Number(process.env.ALERT_FAILURE_THRESHOLD ?? 5),
		failureWindowMs: Number(process.env.ALERT_FAILURE_WINDOW_MS ?? 600_000),
		failureCooldownMs: Number(process.env.ALERT_FAILURE_COOLDOWN_MS ?? 600_000),
	},
} as const;
