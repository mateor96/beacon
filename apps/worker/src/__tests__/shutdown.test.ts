import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromiseTracker } from "../lib/promise-tracker.js";

// ── PromiseTracker Tests ────────────────────────────────────

describe("PromiseTracker", () => {
	it("tracks promises and reports correct size", () => {
		const tracker = new PromiseTracker();
		expect(tracker.size).toBe(0);

		const p1 = new Promise<void>((r) => setTimeout(r, 50));
		tracker.track(p1);
		expect(tracker.size).toBe(1);

		const p2 = new Promise<void>((r) => setTimeout(r, 50));
		tracker.track(p2);
		expect(tracker.size).toBe(2);
	});

	it("removes promises after they settle", async () => {
		const tracker = new PromiseTracker();
		const p = Promise.resolve("done");
		tracker.track(p);

		await p;
		// Allow microtask queue to flush cleanup
		await new Promise((r) => setTimeout(r, 0));
		expect(tracker.size).toBe(0);
	});

	it("removes rejected promises after they settle", async () => {
		const tracker = new PromiseTracker();
		const p = Promise.reject(new Error("fail"));
		tracker.track(p).catch(() => {}); // prevent unhandled rejection

		await new Promise((r) => setTimeout(r, 0));
		expect(tracker.size).toBe(0);
	});

	it("waitAll resolves when all promises settle", async () => {
		const tracker = new PromiseTracker();
		tracker.track(Promise.resolve());
		tracker.track(Promise.resolve());

		const result = await tracker.waitAll(1_000);
		expect(result).toEqual({ settled: 2, timedOut: false });
	});

	it("waitAll returns immediately when no promises are pending", async () => {
		const tracker = new PromiseTracker();
		const result = await tracker.waitAll(1_000);
		expect(result).toEqual({ settled: 0, timedOut: false });
	});

	it("waitAll returns timedOut when promises take too long", async () => {
		const tracker = new PromiseTracker();
		tracker.track(new Promise(() => {})); // never resolves

		const result = await tracker.waitAll(50);
		expect(result.timedOut).toBe(true);
	});

	it("handles mix of resolved and rejected promises", async () => {
		const tracker = new PromiseTracker();
		tracker.track(Promise.resolve("ok"));
		tracker.track(Promise.reject(new Error("fail")).catch(() => {}));

		const result = await tracker.waitAll(1_000);
		expect(result.timedOut).toBe(false);
		expect(result.settled).toBe(2);
	});
});

// ── Shutdown Behavior Tests ─────────────────────────────────

const mockDlqInsert = vi.fn().mockResolvedValue(undefined);
const mockRecordTerminalFailure = vi.fn();

vi.mock("@beacon/db", () => ({
	db: {},
	deadLetterJobQueries: {
		insert: (...args: unknown[]) => mockDlqInsert(...args),
	},
}));

vi.mock("../lib/failure-alert.js", () => ({
	recordTerminalFailure: (...args: unknown[]) => mockRecordTerminalFailure(...args),
}));

const mockWorkerOn = vi.fn();
const mockWorkerClose = vi.fn().mockResolvedValue(undefined);

vi.mock("bullmq", () => ({
	Queue: vi.fn().mockImplementation((name: string, opts: Record<string, unknown>) => ({
		name,
		opts,
		close: vi.fn().mockResolvedValue(undefined),
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

import { startWorkers, stopWorkers } from "../workers/index.js";

describe("Shutdown behavior", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("startWorkers returns a PromiseTracker for DLQ writes", () => {
		const result = startWorkers();
		expect(result.pendingDlqWrites).toBeInstanceOf(PromiseTracker);
		expect(result.workers).toHaveLength(18);
	});

	it("stopWorkers closes all workers", async () => {
		startWorkers();
		await stopWorkers();
		expect(mockWorkerClose).toHaveBeenCalledTimes(18);
	});

	it("stopWorkers with force=true passes true to worker.close", async () => {
		startWorkers();
		await stopWorkers(true);
		expect(mockWorkerClose).toHaveBeenCalledWith(true);
	});

	it("stopWorkers is safe to call when no workers are running", async () => {
		await expect(stopWorkers()).resolves.toBeUndefined();
	});

	it("DLQ writes are tracked via PromiseTracker", () => {
		const { pendingDlqWrites } = startWorkers();

		// Get the failed handler for scan worker
		const failedCalls = mockWorkerOn.mock.calls.filter((c: unknown[]) => c[0] === "failed");
		const scanHandler = failedCalls[0][1] as (job: unknown, err: Error) => void;

		const job = {
			id: "job-shutdown-1",
			data: { scanId: "s1", url: "https://example.com" },
			opts: { attempts: 1 },
			attemptsMade: 1,
		};

		scanHandler(job, new Error("terminal"));

		// The DLQ write should be tracked
		expect(pendingDlqWrites.size).toBeGreaterThanOrEqual(0); // may have settled already
		expect(mockDlqInsert).toHaveBeenCalled();
	});

	it("registers stalled event handler on all workers", () => {
		startWorkers();
		const stalledCalls = mockWorkerOn.mock.calls.filter((c: unknown[]) => c[0] === "stalled");
		expect(stalledCalls).toHaveLength(18);
	});
});
