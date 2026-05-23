import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetById, mockMergeScanFixes, mockGenerateFix, mockFromEnv, mockUpdateFixCheckStatus } =
	vi.hoisted(() => ({
		mockGetById: vi.fn(),
		mockMergeScanFixes: vi.fn().mockResolvedValue({ merged: true, fix_count: 1 }),
		mockGenerateFix: vi.fn(),
		mockFromEnv: vi.fn().mockReturnValue({}),
		mockUpdateFixCheckStatus: vi.fn().mockResolvedValue(undefined),
	}));

vi.mock("@beacon/db", () => ({
	db: {},
	scanQueries: {
		getById: (...args: unknown[]) => mockGetById(...args),
		updateFixCheckStatus: (...args: unknown[]) => mockUpdateFixCheckStatus(...args),
	},
	mergeScanFixes: (...args: unknown[]) => mockMergeScanFixes(...args),
}));

vi.mock("@beacon/ai", () => ({
	FIX_GENERATOR_IDS: ["llms-txt", "schema-org", "agents-md", "robots-txt", "meta-tags"],
	ClaudeClient: { fromEnv: mockFromEnv },
	generateFix: (...args: unknown[]) => mockGenerateFix(...args),
}));

vi.mock("@beacon/shared", async () => {
	const actual = await vi.importActual<typeof import("@beacon/shared")>("@beacon/shared");
	return actual;
});

import { processFix } from "../processors/fix.processor";

function makeJob(
	data: { scanId: string; checkIds: string[] },
	overrides?: { attempts?: number; attemptsMade?: number },
) {
	return {
		id: "fix-job-1",
		data,
		opts: { attempts: overrides?.attempts ?? 1 },
		attemptsMade: overrides?.attemptsMade ?? 0,
		updateProgress: vi.fn(),
	} as Parameters<typeof processFix>[0];
}

const baseScan = {
	id: "scan-1",
	url: "https://example.com",
	htmlContent: "<html><body>Test</body></html>",
	checks: [
		{
			id: "llms-txt",
			name: "LLMs.txt",
			status: "fail",
			category: "readability",
			severity: "high",
			score: 0,
			summary: "Missing",
			issues: [],
		},
		{
			id: "robots-txt",
			name: "Robots.txt",
			status: "pass",
			category: "readability",
			severity: "medium",
			score: 100,
			summary: "OK",
			issues: [],
		},
	],
};

describe("processFix", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("happy path: generates fixes and calls mergeScanFixes", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateFix.mockResolvedValue({
			ok: true,
			data: {
				checkId: "llms-txt",
				content: "# LLMs\n",
				filename: "llms.txt",
				method: "ai-generated",
			},
			usage: [],
		});

		const result = await processFix(makeJob({ scanId: "scan-1", checkIds: ["llms-txt"] }));

		expect(result).toEqual({ scanId: "scan-1", generatedCount: 1 });
		expect(mockMergeScanFixes).toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			expect.objectContaining({ "llms-txt": expect.any(Object) }),
		);
	});

	it("throws if scan not found", async () => {
		mockGetById.mockResolvedValue(undefined);

		await expect(
			processFix(makeJob({ scanId: "missing", checkIds: ["llms-txt"] })),
		).rejects.toThrow("Scan missing not found");
	});

	it("throws if scan has no htmlContent", async () => {
		mockGetById.mockResolvedValue({ ...baseScan, htmlContent: null });

		await expect(processFix(makeJob({ scanId: "scan-1", checkIds: ["llms-txt"] }))).rejects.toThrow(
			"no htmlContent",
		);
	});

	it("skips unsupported checkIds", async () => {
		mockGetById.mockResolvedValue(baseScan);

		const result = await processFix(
			makeJob({ scanId: "scan-1", checkIds: ["unknown-check" as string] }),
		);

		expect(result.generatedCount).toBe(0);
		expect(mockGenerateFix).not.toHaveBeenCalled();
	});

	it("skips checkIds with no matching check in scan results", async () => {
		mockGetById.mockResolvedValue({
			...baseScan,
			checks: [], // no checks
		});

		const result = await processFix(makeJob({ scanId: "scan-1", checkIds: ["llms-txt"] }));

		expect(result.generatedCount).toBe(0);
		expect(mockGenerateFix).not.toHaveBeenCalled();
	});

	it("does not call mergeScanFixes if no fixes generated", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateFix.mockResolvedValue({
			ok: false,
			error: { code: "API_ERROR", message: "fail", attempts: 1 },
			usage: [],
		});

		const result = await processFix(makeJob({ scanId: "scan-1", checkIds: ["llms-txt"] }));

		expect(result.generatedCount).toBe(0);
		expect(mockMergeScanFixes).not.toHaveBeenCalled();
	});

	it("sets per-check status to processing with startedAt before generation", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateFix.mockResolvedValue({
			ok: true,
			data: {
				checkId: "llms-txt",
				content: "# LLMs\n",
				filename: "llms.txt",
				method: "ai-generated",
			},
			usage: [],
		});

		await processFix(makeJob({ scanId: "scan-1", checkIds: ["llms-txt"] }));

		expect(mockUpdateFixCheckStatus).toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			"llms-txt",
			expect.objectContaining({ status: "processing", startedAt: expect.any(String) }),
		);
	});

	it("sets per-check status to completed with completedAt after mergeScanFixes", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateFix.mockResolvedValue({
			ok: true,
			data: {
				checkId: "llms-txt",
				content: "# LLMs\n",
				filename: "llms.txt",
				method: "ai-generated",
			},
			usage: [],
		});

		const callOrder: string[] = [];
		mockMergeScanFixes.mockImplementation(async () => {
			callOrder.push("mergeScanFixes");
			return { merged: true, fix_count: 1 };
		});
		mockUpdateFixCheckStatus.mockImplementation(
			async (_db: unknown, _scanId: unknown, _checkId: unknown, data: { status: string }) => {
				if (data.status === "completed") callOrder.push("completed");
			},
		);

		await processFix(makeJob({ scanId: "scan-1", checkIds: ["llms-txt"] }));

		expect(mockUpdateFixCheckStatus).toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			"llms-txt",
			expect.objectContaining({ status: "completed", completedAt: expect.any(String) }),
		);
		expect(callOrder).toEqual(["mergeScanFixes", "completed"]);
	});

	it("sets per-check status to failed on generation failure", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateFix.mockResolvedValue({
			ok: false,
			error: { code: "API_ERROR", message: "Claude API timeout", attempts: 1 },
			usage: [],
		});

		await processFix(makeJob({ scanId: "scan-1", checkIds: ["llms-txt"] }));

		expect(mockUpdateFixCheckStatus).toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			"llms-txt",
			expect.objectContaining({ status: "failed", error: "Claude API timeout" }),
		);
	});

	it("sets per-check status to failed when generateFix throws", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateFix.mockRejectedValue(new Error("Unexpected crash"));

		await processFix(makeJob({ scanId: "scan-1", checkIds: ["llms-txt"] }));

		expect(mockUpdateFixCheckStatus).toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			"llms-txt",
			expect.objectContaining({ status: "failed", error: "Unexpected crash" }),
		);
	});

	it("marks successful checks as failed when mergeScanFixes throws on last attempt", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateFix.mockResolvedValue({
			ok: true,
			data: {
				checkId: "llms-txt",
				content: "# LLMs\n",
				filename: "llms.txt",
				method: "ai-generated",
			},
			usage: [],
		});
		mockMergeScanFixes.mockRejectedValue(new Error("DB write failed"));

		// attempts: 2, attemptsMade: 1 → isLastAttempt returns true (1 >= 2-1)
		const job = makeJob(
			{ scanId: "scan-1", checkIds: ["llms-txt"] },
			{ attempts: 2, attemptsMade: 1 },
		);

		await expect(processFix(job)).rejects.toThrow("DB write failed");

		expect(mockUpdateFixCheckStatus).toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			"llms-txt",
			expect.objectContaining({
				status: "failed",
				error: expect.stringContaining("mergeScanFixes failed"),
			}),
		);
	});

	it("leaves successful checks as processing when mergeScanFixes throws on non-final attempt", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateFix.mockResolvedValue({
			ok: true,
			data: {
				checkId: "llms-txt",
				content: "# LLMs\n",
				filename: "llms.txt",
				method: "ai-generated",
			},
			usage: [],
		});
		mockMergeScanFixes.mockRejectedValue(new Error("DB write failed"));

		// attempts: 2, attemptsMade: 0 → isLastAttempt returns false (0 < 2-1)
		const job = makeJob(
			{ scanId: "scan-1", checkIds: ["llms-txt"] },
			{ attempts: 2, attemptsMade: 0 },
		);

		await expect(processFix(job)).rejects.toThrow("DB write failed");

		// Should NOT have been marked as failed — stays as processing for retry
		const failedCalls = mockUpdateFixCheckStatus.mock.calls.filter(
			(call: unknown[]) => (call[3] as { status: string }).status === "failed",
		);
		expect(failedCalls).toHaveLength(0);

		// Should NOT have been marked as completed either
		const completedCalls = mockUpdateFixCheckStatus.mock.calls.filter(
			(call: unknown[]) => (call[3] as { status: string }).status === "completed",
		);
		expect(completedCalls).toHaveLength(0);
	});

	it("marks successful check A as failed when check B throws before merge on last attempt", async () => {
		mockGetById.mockResolvedValue({
			...baseScan,
			checks: [
				...baseScan.checks,
				{
					id: "schema-org",
					name: "Schema.org",
					status: "fail",
					category: "readability",
					severity: "high",
					score: 0,
					summary: "Missing",
					issues: [],
				},
			],
		});

		// Check A (llms-txt) succeeds, check B (schema-org) processing status write throws
		let callCount = 0;
		mockGenerateFix.mockResolvedValue({
			ok: true,
			data: {
				checkId: "llms-txt",
				content: "# LLMs\n",
				filename: "llms.txt",
				method: "ai-generated",
			},
			usage: [],
		});
		mockUpdateFixCheckStatus.mockImplementation(
			async (_db: unknown, _scanId: unknown, checkId: unknown, data: { status: string }) => {
				callCount++;
				// Let check A's processing status through, then throw on check B's processing status
				if (checkId === "schema-org" && data.status === "processing") {
					throw new Error("DB connection lost");
				}
			},
		);

		// attempts: 2, attemptsMade: 1 → isLastAttempt returns true
		const job = makeJob(
			{ scanId: "scan-1", checkIds: ["llms-txt", "schema-org"] },
			{ attempts: 2, attemptsMade: 1 },
		);

		await expect(processFix(job)).rejects.toThrow("DB connection lost");

		// Check A was successful but unpersisted — should be marked failed on last attempt
		const failedCalls = mockUpdateFixCheckStatus.mock.calls.filter(
			(call: unknown[]) => (call[3] as { status: string }).status === "failed",
		);
		const failedCheckIds = failedCalls.map((call: unknown[]) => call[2]);
		expect(failedCheckIds).toContain("llms-txt");
		expect(failedCheckIds).toContain("schema-org");
	});
});
