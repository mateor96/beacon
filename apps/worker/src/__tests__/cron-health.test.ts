import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@beacon/queue", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@beacon/queue")>();
	return {
		...actual,
		pingRedis: vi.fn().mockResolvedValue(true),
	};
});

import { Hono } from "hono";
import type { CronRegistry } from "../cron/registry.js";
import type { CronHealthEntry } from "../cron/types.js";
import { registerHealthRoute } from "../health.js";

function makeMockRegistry(jobs: CronHealthEntry[]): CronRegistry {
	return {
		getHealth: vi.fn().mockResolvedValue(jobs),
	} as unknown as CronRegistry;
}

function createApp(cronRegistry?: CronRegistry) {
	const app = new Hono();
	registerHealthRoute(app, () => false, cronRegistry);
	return app;
}

describe("GET /api/admin/cron/health", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns registered jobs", async () => {
		const jobs: CronHealthEntry[] = [
			{
				name: "cleanup",
				pattern: "0 0 * * *",
				description: "Daily cleanup",
				lastRun: null,
				lastDurationMs: null,
				lastStatus: null,
				lastError: null,
				nextRun: "2026-04-05T00:00:00.000Z",
			},
			{
				name: "metrics",
				pattern: "*/5 * * * *",
				description: "Collect metrics",
				lastRun: null,
				lastDurationMs: null,
				lastStatus: null,
				lastError: null,
				nextRun: "2026-04-04T12:05:00.000Z",
			},
		];

		const app = createApp(makeMockRegistry(jobs));
		const res = await app.request("/api/admin/cron/health");
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.jobs).toHaveLength(2);
		expect(body.jobs[0].name).toBe("cleanup");
		expect(body.jobs[1].name).toBe("metrics");
	});

	it("returns empty when no registry", async () => {
		const app = createApp(); // no cronRegistry passed
		const res = await app.request("/api/admin/cron/health");
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.jobs).toEqual([]);
	});

	it("includes lastRun and nextRun", async () => {
		const jobs: CronHealthEntry[] = [
			{
				name: "sync",
				pattern: "0 * * * *",
				description: "Hourly sync",
				lastRun: "2026-04-04T11:00:00.000Z",
				lastDurationMs: 1234,
				lastStatus: "success",
				lastError: null,
				nextRun: "2026-04-04T12:00:00.000Z",
			},
		];

		const app = createApp(makeMockRegistry(jobs));
		const res = await app.request("/api/admin/cron/health");
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.jobs[0].lastRun).toBe("2026-04-04T11:00:00.000Z");
		expect(body.jobs[0].nextRun).toBe("2026-04-04T12:00:00.000Z");
	});

	it("shows lastError for failed jobs", async () => {
		const jobs: CronHealthEntry[] = [
			{
				name: "broken",
				pattern: "0 0 * * *",
				description: "Broken job",
				lastRun: "2026-04-04T00:00:00.000Z",
				lastDurationMs: 500,
				lastStatus: "failed",
				lastError: "Connection refused",
				nextRun: "2026-04-05T00:00:00.000Z",
			},
		];

		const app = createApp(makeMockRegistry(jobs));
		const res = await app.request("/api/admin/cron/health");
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.jobs[0].lastStatus).toBe("failed");
		expect(body.jobs[0].lastError).toBe("Connection refused");
	});
});
