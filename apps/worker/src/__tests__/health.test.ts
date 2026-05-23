import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPingRedis, mockGetQueueMetrics } = vi.hoisted(() => ({
	mockPingRedis: vi.fn<() => Promise<boolean>>(),
	mockGetQueueMetrics: vi.fn(),
}));

vi.mock("@beacon/queue", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@beacon/queue")>();
	return {
		...actual,
		pingRedis: mockPingRedis,
		getQueueMetrics: mockGetQueueMetrics,
	};
});

import { Hono } from "hono";
import { registerHealthRoute } from "../health";

function makeMetrics(overrides: Array<{ name: string; waiting?: number; failed?: number }> = []) {
	const defaults = [
		{ name: "scan", waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
	];
	const queues =
		overrides.length > 0
			? overrides.map((o) => ({
					name: o.name,
					counts: {
						waiting: o.waiting ?? 0,
						active: 0,
						completed: 0,
						failed: o.failed ?? 0,
						delayed: 0,
						paused: 0,
					},
					error: false,
				}))
			: defaults.map((d) => ({ name: d.name, counts: d, error: false }));
	return { queues, collectedAt: new Date().toISOString(), partial: false };
}

function createApp(isShuttingDown = false) {
	const app = new Hono();
	registerHealthRoute(app, () => isShuttingDown);
	return app;
}

describe("GET /health", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetQueueMetrics.mockResolvedValue(makeMetrics());
	});

	it("returns 200 ready when Redis is reachable", async () => {
		mockPingRedis.mockResolvedValue(true);
		const app = createApp();

		const res = await app.request("/health");
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.status).toBe("ready");
		expect(body.redis).toBe(true);
		expect(body.service).toBe("worker");
		expect(body.queues).toEqual([
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
		]);
	});

	it("returns 503 degraded when Redis is unreachable", async () => {
		mockPingRedis.mockResolvedValue(false);
		const app = createApp();

		const res = await app.request("/health");
		const body = await res.json();

		expect(res.status).toBe(503);
		expect(body.status).toBe("degraded");
		expect(body.redis).toBe(false);
	});

	it("returns 503 shutting_down and skips ping", async () => {
		const app = createApp(true);

		const res = await app.request("/health");
		const body = await res.json();

		expect(res.status).toBe(503);
		expect(body.status).toBe("shutting_down");
		expect(body.redis).toBeNull();
		expect(mockPingRedis).not.toHaveBeenCalled();
		expect(mockGetQueueMetrics).not.toHaveBeenCalled();
	});

	it("includes queueMetrics and queueHealth in response", async () => {
		mockPingRedis.mockResolvedValue(true);
		mockGetQueueMetrics.mockResolvedValue(
			makeMetrics([
				{ name: "scan", waiting: 5, failed: 2 },
				{ name: "fix", waiting: 3, failed: 1 },
			]),
		);
		const app = createApp();

		const res = await app.request("/health");
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.status).toBe("ready");
		expect(body.queueMetrics).toHaveLength(2);
		expect(body.queueMetrics[0]).toMatchObject({ name: "scan", waiting: 5, failed: 2 });
		expect(body.queueHealth).toEqual({ totalWaiting: 8, totalFailed: 3 });
	});

	it("returns degraded status when a queue has backlog > 100", async () => {
		mockPingRedis.mockResolvedValue(true);
		mockGetQueueMetrics.mockResolvedValue(makeMetrics([{ name: "scan", waiting: 150 }]));
		const app = createApp();

		const res = await app.request("/health");
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.status).toBe("degraded");
		expect(body.queueHealth.totalWaiting).toBe(150);
	});
});
