import { describe, expect, it, vi } from "vitest";
import { QUEUE_NAMES } from "../config.js";

// Mock BullMQ and the client module
vi.mock("bullmq", () => ({
	Queue: vi.fn(),
}));

vi.mock("../client.js", () => ({
	getQueues: vi.fn(),
}));

import { getQueues } from "../client.js";
import { getQueueMetrics, getSingleQueueMetrics } from "../metrics.js";

const mockedGetQueues = vi.mocked(getQueues);

function makeMockQueue(counts: Record<string, number> = {}) {
	return {
		getJobCounts: vi.fn().mockResolvedValue({
			waiting: 0,
			active: 0,
			completed: 0,
			failed: 0,
			delayed: 0,
			paused: 0,
			...counts,
		}),
	};
}

function makeMockQueues(overrides: Partial<Record<string, ReturnType<typeof makeMockQueue>>> = {}) {
	const queues: Record<string, ReturnType<typeof makeMockQueue>> = {};
	for (const name of QUEUE_NAMES) {
		queues[name] = overrides[name] ?? makeMockQueue();
	}
	return queues as unknown as ReturnType<typeof getQueues>;
}

describe("getQueueMetrics", () => {
	it("returns counts for all queues", async () => {
		mockedGetQueues.mockReturnValue(
			makeMockQueues({
				scan: makeMockQueue({ waiting: 5, active: 2, completed: 100 }),
				fix: makeMockQueue({ failed: 3 }),
			}),
		);

		const metrics = await getQueueMetrics();

		expect(metrics.queues).toHaveLength(QUEUE_NAMES.length);
		expect(metrics.partial).toBe(false);
		expect(metrics.collectedAt).toBeDefined();

		const scan = metrics.queues.find((q) => q.name === "scan");
		if (!scan) throw new Error("expected scan queue in metrics");
		expect(scan.counts.waiting).toBe(5);
		expect(scan.counts.active).toBe(2);
		expect(scan.counts.completed).toBe(100);
		expect(scan.error).toBe(false);

		const fix = metrics.queues.find((q) => q.name === "fix");
		if (!fix) throw new Error("expected fix queue in metrics");
		expect(fix.counts.failed).toBe(3);
	});

	it("returns empty counts for idle queues", async () => {
		mockedGetQueues.mockReturnValue(makeMockQueues());

		const metrics = await getQueueMetrics();

		for (const queue of metrics.queues) {
			expect(queue.counts.waiting).toBe(0);
			expect(queue.counts.active).toBe(0);
			expect(queue.counts.completed).toBe(0);
			expect(queue.counts.failed).toBe(0);
			expect(queue.counts.delayed).toBe(0);
			expect(queue.counts.paused).toBe(0);
			expect(queue.error).toBe(false);
		}
		expect(metrics.partial).toBe(false);
	});

	it("handles partial failure gracefully", async () => {
		const failingQueue = {
			getJobCounts: vi.fn().mockRejectedValue(new Error("Redis connection lost")),
		};

		mockedGetQueues.mockReturnValue(
			makeMockQueues({
				scan: makeMockQueue({ waiting: 10 }),
				fix: failingQueue as unknown as ReturnType<typeof makeMockQueue>,
			}),
		);

		const metrics = await getQueueMetrics();

		expect(metrics.partial).toBe(true);

		const scan = metrics.queues.find((q) => q.name === "scan");
		if (!scan) throw new Error("expected scan queue in metrics");
		expect(scan.counts.waiting).toBe(10);
		expect(scan.error).toBe(false);

		const fix = metrics.queues.find((q) => q.name === "fix");
		if (!fix) throw new Error("expected fix queue in metrics");
		expect(fix.error).toBe(true);
		expect(fix.errorMessage).toBe("Redis connection lost");
		expect(fix.counts.waiting).toBe(0);
		expect(fix.counts.active).toBe(0);
	});

	it("handles all queues failing", async () => {
		const failingQueue = {
			getJobCounts: vi.fn().mockRejectedValue(new Error("Redis down")),
		};

		const queues: Record<string, unknown> = {};
		for (const name of QUEUE_NAMES) {
			queues[name] = failingQueue;
		}
		mockedGetQueues.mockReturnValue(queues as unknown as ReturnType<typeof getQueues>);

		const metrics = await getQueueMetrics();

		expect(metrics.partial).toBe(true);
		for (const queue of metrics.queues) {
			expect(queue.error).toBe(true);
			expect(queue.errorMessage).toBe("Redis down");
		}
	});
});

describe("getSingleQueueMetrics", () => {
	it("returns metrics for a specific queue", async () => {
		mockedGetQueues.mockReturnValue(
			makeMockQueues({
				report: makeMockQueue({ active: 1, delayed: 2 }),
			}),
		);

		const metrics = await getSingleQueueMetrics("report");

		expect(metrics.name).toBe("report");
		expect(metrics.counts.active).toBe(1);
		expect(metrics.counts.delayed).toBe(2);
		expect(metrics.error).toBe(false);
	});

	it("handles failure for a single queue", async () => {
		const failingQueue = {
			getJobCounts: vi.fn().mockRejectedValue(new Error("Timeout")),
		};

		mockedGetQueues.mockReturnValue(
			makeMockQueues({
				analysis: failingQueue as unknown as ReturnType<typeof makeMockQueue>,
			}),
		);

		const metrics = await getSingleQueueMetrics("analysis");

		expect(metrics.name).toBe("analysis");
		expect(metrics.error).toBe(true);
		expect(metrics.errorMessage).toBe("Timeout");
		expect(metrics.counts.waiting).toBe(0);
	});
});
