import { getQueueMetrics } from "@beacon/queue";
import type { Hono } from "hono";
import type { CronRegistry } from "./cron/registry.js";
import { QUEUE_NAMES, pingRedis } from "./queues/index.js";

const BACKLOG_THRESHOLD = 100;

export function registerHealthRoute(
	app: Hono,
	isShuttingDown: () => boolean,
	cronRegistry?: CronRegistry,
): void {
	app.get("/health", async (c) => {
		if (isShuttingDown()) {
			return c.json(
				{
					status: "shutting_down",
					service: "worker",
					redis: null,
					queues: [...QUEUE_NAMES],
					queueMetrics: null,
					queueHealth: null,
				},
				503,
			);
		}

		const [redisOk, metrics] = await Promise.all([pingRedis(), getQueueMetrics()]);

		const totalWaiting = metrics.queues.reduce((sum, q) => sum + q.counts.waiting, 0);
		const totalFailed = metrics.queues.reduce((sum, q) => sum + q.counts.failed, 0);
		const hasBacklog = metrics.queues.some((q) => q.counts.waiting > BACKLOG_THRESHOLD);

		let status: string;
		if (!redisOk) {
			status = "degraded";
		} else if (hasBacklog) {
			status = "degraded";
		} else {
			status = "ready";
		}

		return c.json(
			{
				status,
				service: "worker",
				redis: redisOk,
				queues: [...QUEUE_NAMES],
				queueMetrics: metrics.queues.map((q) => ({
					name: q.name,
					waiting: q.counts.waiting,
					active: q.counts.active,
					completed: q.counts.completed,
					failed: q.counts.failed,
					delayed: q.counts.delayed,
				})),
				queueHealth: { totalWaiting, totalFailed },
			},
			redisOk ? 200 : 503,
		);
	});

	app.get("/api/admin/queues", async (c) => {
		const metrics = await getQueueMetrics();
		return c.json(metrics, 200);
	});

	app.get("/api/admin/queues/dlq", async (c) => {
		const { db, deadLetterJobQueries } = await import("@beacon/db");
		const counts = await deadLetterJobQueries.countByQueue(db);
		return c.json({ dlq: counts }, 200);
	});

	app.get("/api/admin/providers/health", async (c) => {
		const { createConfiguredProviders } = await import("@beacon/ai");
		const providers = createConfiguredProviders();
		const results = await Promise.all(
			providers.map(async (p) => {
				const check = await p.healthCheck();
				return { engine: p.engine, ...check };
			}),
		);
		return c.json({ providers: results, timestamp: new Date().toISOString() }, 200);
	});

	app.get("/api/admin/cron/health", async (c) => {
		if (!cronRegistry) {
			return c.json({ jobs: [] }, 200);
		}
		const jobs = await cronRegistry.getHealth();
		return c.json({ jobs }, 200);
	});
}
