import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ───────────────────────────────────────────────────

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

// ── Helpers ─────────────────────────────────────────────────

function getFailedHandler(workerName: string): (job: unknown, err: Error) => void {
	const calls = mockWorkerOn.mock.calls.filter((call: unknown[]) => call[0] === "failed");
	// Workers are created in order: scan, fix, report, analysis
	// Each worker registers "failed", "stalled", then "error", so calls are interleaved
	const workerNames = ["scan", "fix", "report", "analysis"];
	const idx = workerNames.indexOf(workerName);
	return calls[idx][1] as (job: unknown, err: Error) => void;
}

// ── Tests ───────────────────────────────────────────────────

describe("DLQ capture in worker failed handler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockDlqInsert.mockReset();
		mockDlqInsert.mockResolvedValue(undefined);
		startWorkers();
	});

	it("terminal failure inserts into DLQ and records alert", async () => {
		const handler = getFailedHandler("scan");
		const job = {
			id: "job-123",
			data: { scanId: "s1", url: "https://example.com" },
			opts: { attempts: 3 },
			attemptsMade: 3, // BullMQ increments before calling handler
		};

		handler(job, new Error("timeout"));

		expect(mockDlqInsert).toHaveBeenCalledWith(
			expect.anything(), // db
			expect.objectContaining({
				queue: "scan",
				jobId: "job-123",
				jobData: { scanId: "s1", url: "https://example.com" },
				errorMessage: "timeout",
				attemptsMade: 3,
				maxAttempts: 3,
			}),
		);

		expect(mockRecordTerminalFailure).toHaveBeenCalledWith({
			queue: "scan",
			jobId: "job-123",
			error: "timeout",
		});
	});

	it("non-terminal failure does NOT insert into DLQ", () => {
		const handler = getFailedHandler("scan");
		const job = {
			id: "job-456",
			data: { scanId: "s2", url: "https://example.com" },
			opts: { attempts: 3 },
			attemptsMade: 1, // only 1st attempt done, 2 more left
		};

		handler(job, new Error("temporary error"));

		expect(mockDlqInsert).not.toHaveBeenCalled();
		expect(mockRecordTerminalFailure).not.toHaveBeenCalled();
	});

	it("handles job === undefined gracefully", () => {
		const handler = getFailedHandler("scan");
		// Should not throw
		expect(() => handler(undefined, new Error("no job"))).not.toThrow();
		expect(mockDlqInsert).not.toHaveBeenCalled();
	});

	it("DB write failure is caught and does not crash worker", async () => {
		const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
		mockDlqInsert.mockRejectedValueOnce(new Error("DB down"));

		const handler = getFailedHandler("scan");
		const job = {
			id: "job-789",
			data: { scanId: "s3", url: "https://example.com" },
			opts: { attempts: 1 },
			attemptsMade: 1,
		};

		handler(job, new Error("fail"));

		// Wait for the async DLQ insert failure to be logged
		await vi.waitFor(() => {
			expect(stderrSpy).toHaveBeenCalled();
		});

		stderrSpy.mockRestore();
	});

	it("passes correct queue name for different workers", () => {
		const fixHandler = getFailedHandler("fix");
		const job = {
			id: "job-fix-1",
			data: { scanId: "s4", checkIds: ["llms-txt"] },
			opts: { attempts: 2 },
			attemptsMade: 2,
		};

		fixHandler(job, new Error("Claude API error"));

		expect(mockDlqInsert).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				queue: "fix",
				jobId: "job-fix-1",
				maxAttempts: 2,
			}),
		);
	});

	it("terminal failure for report worker inserts correct queue name", () => {
		const handler = getFailedHandler("report");
		const job = {
			id: "job-report-1",
			data: { scanId: "s5" },
			opts: { attempts: 2 },
			attemptsMade: 2,
		};

		handler(job, new Error("PDF generation failed"));

		expect(mockDlqInsert).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ queue: "report" }),
		);
	});

	it("terminal failure for analysis worker inserts correct queue name", () => {
		const handler = getFailedHandler("analysis");
		const job = {
			id: "job-analysis-1",
			data: { scanId: "s6", type: "semantic" },
			opts: { attempts: 2 },
			attemptsMade: 2,
		};

		handler(job, new Error("Claude API timeout"));

		expect(mockDlqInsert).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ queue: "analysis" }),
		);
	});

	it("DLQ insert retries on DB failure and falls back to stderr", async () => {
		const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
		mockDlqInsert.mockRejectedValue(new Error("DB down"));

		const handler = getFailedHandler("scan");
		const job = {
			id: "job-stderr-1",
			data: { scanId: "s7", url: "https://example.com" },
			opts: { attempts: 1 },
			attemptsMade: 1,
		};

		handler(job, new Error("terminal"));

		// Wait for retries (2 retries * 2s delay) + some margin
		await vi.waitFor(
			() => {
				expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("dlq_persistence_failure"));
			},
			{ timeout: 10_000 },
		);

		// Should have attempted at least 3 times (1 initial + 2 retries)
		expect(mockDlqInsert.mock.calls.length).toBeGreaterThanOrEqual(3);

		stderrSpy.mockRestore();
	});
});
