import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────

const mockInsertDlqWithRetry = vi.fn().mockResolvedValue(undefined);

vi.mock("../lib/dlq.js", () => ({
	insertDlqWithRetry: (...args: unknown[]) => mockInsertDlqWithRetry(...args),
}));

vi.mock("../lib/logger.js", () => ({
	createSystemLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}),
}));

vi.mock("@beacon/queue", () => ({
	getConnectionOptions: () => ({ host: "localhost", port: 6379 }),
	QUEUE_PREFIX: "beacon:",
}));

const mockUpsertJobScheduler = vi.fn().mockResolvedValue(undefined);
const mockGetJobSchedulers = vi.fn().mockResolvedValue([]);
const mockRemoveJobScheduler = vi.fn().mockResolvedValue(undefined);
const mockQueueClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerOn = vi.fn();

let capturedProcessor: ((job: unknown) => Promise<unknown>) | null = null;

vi.mock("bullmq", () => ({
	Queue: vi.fn().mockImplementation(() => ({
		upsertJobScheduler: mockUpsertJobScheduler,
		getJobSchedulers: mockGetJobSchedulers,
		removeJobScheduler: mockRemoveJobScheduler,
		close: mockQueueClose,
	})),
	Worker: vi
		.fn()
		.mockImplementation((_name: string, processor: (job: unknown) => Promise<unknown>) => {
			capturedProcessor = processor;
			return {
				on: mockWorkerOn,
				close: mockWorkerClose,
			};
		}),
}));

import { CronRegistry } from "../cron/registry.js";

// ── Tests ────────────────────────────────────────────────────

describe("CronRegistry", () => {
	let registry: CronRegistry;

	beforeEach(() => {
		vi.clearAllMocks();
		capturedProcessor = null;
		registry = new CronRegistry();
	});

	it("register() stores job definitions", async () => {
		registry.register({
			name: "job-a",
			pattern: "*/5 * * * *",
			handler: async () => ({}),
		});
		registry.register({
			name: "job-b",
			pattern: "0 0 * * *",
			handler: async () => ({}),
		});

		const health = await registry.getHealth();
		expect(health).toHaveLength(2);
		expect(health.map((h) => h.name)).toEqual(["job-a", "job-b"]);
	});

	it("register() rejects duplicate names", () => {
		registry.register({
			name: "dupe",
			pattern: "* * * * *",
			handler: async () => ({}),
		});
		expect(() =>
			registry.register({
				name: "dupe",
				pattern: "* * * * *",
				handler: async () => ({}),
			}),
		).toThrow("Duplicate cron job name: dupe");
	});

	it('register() resolves @daily shortcut to "0 0 * * *"', async () => {
		registry.register({
			name: "daily-job",
			pattern: "@daily",
			handler: async () => ({}),
		});

		const health = await registry.getHealth();
		expect(health[0].pattern).toBe("0 0 * * *");
	});

	it('register() resolves @hourly shortcut to "0 * * * *"', async () => {
		registry.register({
			name: "hourly-job",
			pattern: "@hourly",
			handler: async () => ({}),
		});

		const health = await registry.getHealth();
		expect(health[0].pattern).toBe("0 * * * *");
	});

	it("register() after start() throws", async () => {
		registry.register({
			name: "pre-start",
			pattern: "* * * * *",
			handler: async () => ({}),
		});
		await registry.start();

		expect(() =>
			registry.register({
				name: "post-start",
				pattern: "* * * * *",
				handler: async () => ({}),
			}),
		).toThrow("Cannot register after start()");
	});

	it("start() calls upsertJobScheduler for each job", async () => {
		registry.register({
			name: "sched-a",
			pattern: "*/10 * * * *",
			handler: async () => ({}),
		});
		registry.register({
			name: "sched-b",
			pattern: "0 0 * * *",
			handler: async () => ({}),
		});

		await registry.start();

		expect(mockUpsertJobScheduler).toHaveBeenCalledTimes(2);
		expect(mockUpsertJobScheduler).toHaveBeenCalledWith(
			"sched-a",
			{ pattern: "*/10 * * * *" },
			expect.objectContaining({ name: "sched-a" }),
		);
		expect(mockUpsertJobScheduler).toHaveBeenCalledWith(
			"sched-b",
			{ pattern: "0 0 * * *" },
			expect.objectContaining({ name: "sched-b" }),
		);
	});

	it("start() removes stale schedulers not in registry", async () => {
		mockGetJobSchedulers.mockResolvedValueOnce([{ name: "active-job" }, { name: "stale-job" }]);

		registry.register({
			name: "active-job",
			pattern: "* * * * *",
			handler: async () => ({}),
		});

		await registry.start();

		expect(mockRemoveJobScheduler).toHaveBeenCalledTimes(1);
		expect(mockRemoveJobScheduler).toHaveBeenCalledWith("stale-job");
	});

	it("stop() closes worker and queue", async () => {
		registry.register({
			name: "closable",
			pattern: "* * * * *",
			handler: async () => ({}),
		});
		await registry.start();
		await registry.stop();

		expect(mockWorkerClose).toHaveBeenCalledTimes(1);
		expect(mockQueueClose).toHaveBeenCalledTimes(1);
	});

	it("processor dispatches to correct handler by job.name", async () => {
		const handlerA = vi.fn().mockResolvedValue({ ok: true });
		const handlerB = vi.fn().mockResolvedValue({ ok: true });

		registry.register({ name: "dispatch-a", pattern: "* * * * *", handler: handlerA });
		registry.register({ name: "dispatch-b", pattern: "* * * * *", handler: handlerB });

		await registry.start();

		expect(capturedProcessor).toBeTruthy();
		await capturedProcessor?.({ name: "dispatch-a", data: {} });

		expect(handlerA).toHaveBeenCalledTimes(1);
		expect(handlerB).not.toHaveBeenCalled();
	});

	it("terminal failure calls insertDlqWithRetry with cron: prefix", async () => {
		registry.register({
			name: "failing-job",
			pattern: "* * * * *",
			handler: async () => ({}),
		});

		await registry.start();

		// Extract the "failed" event handler
		const failedCalls = mockWorkerOn.mock.calls.filter((c: unknown[]) => c[0] === "failed");
		expect(failedCalls).toHaveLength(1);

		const failedHandler = failedCalls[0][1] as (job: unknown, err: Error) => void;

		const job = {
			name: "failing-job",
			id: "job-123",
			data: { test: true },
			opts: { attempts: 3 },
			attemptsMade: 3,
		};

		failedHandler(job, new Error("terminal failure"));

		expect(mockInsertDlqWithRetry).toHaveBeenCalledTimes(1);
		expect(mockInsertDlqWithRetry).toHaveBeenCalledWith(
			expect.objectContaining({
				queue: "cron:failing-job",
				jobId: "job-123",
				errorMessage: "terminal failure",
				attemptsMade: 3,
				maxAttempts: 3,
			}),
		);
	});
});
