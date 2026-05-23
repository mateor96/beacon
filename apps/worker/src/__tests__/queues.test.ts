import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQueueClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerOn = vi.fn();
const mockWorkerClose = vi.fn().mockResolvedValue(undefined);

vi.mock("bullmq", () => ({
	Queue: vi.fn().mockImplementation((name: string, opts: Record<string, unknown>) => ({
		name,
		opts,
		close: mockQueueClose,
	})),
	Worker: vi
		.fn()
		.mockImplementation((name: string, _processor: unknown, opts: Record<string, unknown>) => ({
			name,
			opts,
			on: mockWorkerOn,
			close: mockWorkerClose,
		})),
}));

import {
	QUEUE_CONFIG,
	QUEUE_NAMES,
	closeAllQueues,
	getConnectionOptions,
	getQueues,
} from "@beacon/queue";
import { Queue, Worker } from "bullmq";
import { createWorker } from "../workers/create-worker";
import { startWorkers, stopWorkers } from "../workers/index";

function findQueueCall(name: string): unknown[] {
	const calls = (Queue as unknown as ReturnType<typeof vi.fn>).mock.calls;
	const call = calls.find((entry: unknown[]) => entry[0] === name);
	expect(call).toBeDefined();
	return call as unknown[];
}

describe("getConnectionOptions", () => {
	it("returns maxRetriesPerRequest null", () => {
		const opts = getConnectionOptions() as Record<string, unknown>;
		expect(opts.maxRetriesPerRequest).toBeNull();
	});

	it("returns enableReadyCheck false", () => {
		const opts = getConnectionOptions() as Record<string, unknown>;
		expect(opts.enableReadyCheck).toBe(false);
	});

	it("uses config host and port", () => {
		const opts = getConnectionOptions() as Record<string, unknown>;
		expect(opts.host).toBe("localhost");
		expect(opts.port).toBe(6379);
	});

	it("uses config password", () => {
		const opts = getConnectionOptions() as Record<string, unknown>;
		expect(opts.password).toBe("test");
	});
});

describe("getQueues", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset the lazy singleton by closing all queues
		closeAllQueues();
	});

	it("creates exactly 10 queues", () => {
		const queues = getQueues();
		expect(Object.keys(queues)).toHaveLength(QUEUE_NAMES.length);
	});

	it("each queue has correct name", () => {
		const queues = getQueues();
		expect(Object.keys(queues)).toEqual([...QUEUE_NAMES]);
	});

	it("each queue uses 'beacon' prefix", () => {
		getQueues();
		for (const call of (Queue as unknown as ReturnType<typeof vi.fn>).mock.calls) {
			expect(call[1].prefix).toBe("beacon");
		}
	});

	it("all queues have correct removeOnComplete and removeOnFail from config", () => {
		getQueues();
		for (const name of QUEUE_NAMES) {
			const call = findQueueCall(name);
			expect(call[1].defaultJobOptions.removeOnComplete).toEqual(
				QUEUE_CONFIG[name].defaultJobOptions.removeOnComplete,
			);
			expect(call[1].defaultJobOptions.removeOnFail).toEqual(
				QUEUE_CONFIG[name].defaultJobOptions.removeOnFail,
			);
		}
	});

	it("all queues use exponential backoff", () => {
		getQueues();
		for (const name of QUEUE_NAMES) {
			const call = findQueueCall(name);
			expect(call[1].defaultJobOptions.backoff.type).toBe("exponential");
		}
	});

	it("scan backoff delay is 2000ms, others are 5000ms", () => {
		getQueues();
		expect(findQueueCall("scan")[1].defaultJobOptions.backoff.delay).toBe(2_000);
		for (const name of ["fix", "report", "analysis"]) {
			expect(findQueueCall(name)[1].defaultJobOptions.backoff.delay).toBe(5_000);
		}
	});

	it("scan queue has attempts:3, fix/report/analysis have attempts:2", () => {
		getQueues();
		const scanCall = findQueueCall("scan");
		const fixCall = findQueueCall("fix");
		const reportCall = findQueueCall("report");
		const analysisCall = findQueueCall("analysis");

		expect(scanCall[1].defaultJobOptions.attempts).toBe(3);
		expect(fixCall[1].defaultJobOptions.attempts).toBe(2);
		expect(reportCall[1].defaultJobOptions.attempts).toBe(2);
		expect(analysisCall[1].defaultJobOptions.attempts).toBe(2);
	});
});

describe("createWorker", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("passes concurrency from QUEUE_CONFIG", () => {
		const processor = vi.fn();
		createWorker("scan", processor);
		const call = (Worker as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(call[2].concurrency).toBe(QUEUE_CONFIG.scan.concurrency);
	});

	it("passes limiter for fix queue", () => {
		const processor = vi.fn();
		createWorker("fix", processor);
		const call = (Worker as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(call[2].limiter).toEqual({ max: 10, duration: 60_000 });
	});

	it("does not pass limiter for scan queue", () => {
		const processor = vi.fn();
		createWorker("scan", processor);
		const call = (Worker as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(call[2].limiter).toBeUndefined();
	});
});

describe("lifecycle", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("closeAllQueues calls close on all queues", async () => {
		getQueues();
		await closeAllQueues();
		expect(mockQueueClose).toHaveBeenCalledTimes(QUEUE_NAMES.length);
	});

	it("stopWorkers calls close on all workers", async () => {
		startWorkers();
		await stopWorkers();
		expect(mockWorkerClose).toHaveBeenCalledTimes(QUEUE_NAMES.length);
	});
});
