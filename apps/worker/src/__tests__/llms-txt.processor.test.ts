import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetById, mockGenerateLlmsTxt, mockFromEnv } = vi.hoisted(() => ({
	mockGetById: vi.fn(),
	mockGenerateLlmsTxt: vi.fn(),
	mockFromEnv: vi.fn().mockReturnValue({}),
}));

vi.mock("@beacon/db", () => ({
	db: {},
	scanQueries: {
		getById: (...args: unknown[]) => mockGetById(...args),
	},
}));

vi.mock("@beacon/ai", () => ({
	ClaudeClient: { fromEnv: mockFromEnv },
	generateLlmsTxt: (...args: unknown[]) => mockGenerateLlmsTxt(...args),
}));

import { processLlmsTxt } from "../processors/llms-txt.processor";

function makeJob(data: { scanId: string; force?: boolean }) {
	return {
		id: "llms-txt-job-1",
		data,
		opts: { attempts: 2 },
		attemptsMade: 0,
		updateProgress: vi.fn(),
	} as Parameters<typeof processLlmsTxt>[0];
}

const baseScan = {
	id: "00000000-0000-4000-a000-000000000001",
	userId: "00000000-0000-4000-a000-000000000002",
	url: "https://example.com",
	finalUrl: "https://www.example.com",
	htmlContent: "<html><body><h1>Hello</h1></body></html>",
	checks: [
		{
			id: "llms-txt",
			status: "fail",
			score: 0,
			summary: "Missing",
			issues: [{ message: "no llms.txt", severity: "critical" }],
		},
		{
			id: "robots-txt",
			status: "pass",
			score: 100,
			summary: "OK",
			issues: [],
		},
	],
};

describe("processLlmsTxt", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("happy path: passes finalUrl + llms-txt check to the generator and returns its result", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateLlmsTxt.mockResolvedValue({
			fixId: "fix-1",
			version: 1,
			content: "# Hello",
			contentHash: "hash-1",
			inputHash: "input-hash-1",
			method: "ai-generated",
			costCents: 0.5,
		});

		const result = await processLlmsTxt(makeJob({ scanId: baseScan.id }));

		expect(result).toEqual({
			scanId: baseScan.id,
			fixId: "fix-1",
			version: 1,
			method: "ai-generated",
			costCents: 0.5,
		});

		expect(mockGenerateLlmsTxt).toHaveBeenCalledTimes(1);
		const call = mockGenerateLlmsTxt.mock.calls[0]?.[0] as {
			scanId: string;
			finalUrl: string;
			htmlContent: string;
			llmsCheck: { id: string };
			force?: boolean;
		};
		expect(call.scanId).toBe(baseScan.id);
		// Review P1 #5: must use finalUrl when present
		expect(call.finalUrl).toBe(baseScan.finalUrl);
		expect(call.htmlContent).toBe(baseScan.htmlContent);
		expect(call.llmsCheck?.id).toBe("llms-txt");
		expect(call.force).toBeUndefined();
	});

	it("falls back to scan.url when scan.finalUrl is null", async () => {
		mockGetById.mockResolvedValue({ ...baseScan, finalUrl: null });
		mockGenerateLlmsTxt.mockResolvedValue({
			fixId: "fix-2",
			version: 1,
			content: "# Hello",
			contentHash: "h",
			inputHash: "i",
			method: "template-fallback",
			costCents: 0,
		});

		await processLlmsTxt(makeJob({ scanId: baseScan.id }));

		const call = mockGenerateLlmsTxt.mock.calls[0]?.[0] as { finalUrl: string };
		expect(call.finalUrl).toBe(baseScan.url);
	});

	it("forwards the force flag", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateLlmsTxt.mockResolvedValue({
			fixId: "fix-3",
			version: 2,
			content: "# Hello",
			contentHash: "h",
			inputHash: "i",
			method: "ai-generated",
			costCents: 0.5,
		});

		await processLlmsTxt(makeJob({ scanId: baseScan.id, force: true }));

		const call = mockGenerateLlmsTxt.mock.calls[0]?.[0] as { force?: boolean };
		expect(call.force).toBe(true);
	});

	it("throws when the scan is not found", async () => {
		mockGetById.mockResolvedValue(null);
		await expect(processLlmsTxt(makeJob({ scanId: "missing" }))).rejects.toThrow(/not found/);
		expect(mockGenerateLlmsTxt).not.toHaveBeenCalled();
	});

	it("throws when the scan has no htmlContent", async () => {
		mockGetById.mockResolvedValue({ ...baseScan, htmlContent: null });
		await expect(processLlmsTxt(makeJob({ scanId: baseScan.id }))).rejects.toThrow(
			/no htmlContent/,
		);
		expect(mockGenerateLlmsTxt).not.toHaveBeenCalled();
	});

	it("propagates generator errors so BullMQ can retry", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateLlmsTxt.mockRejectedValue(
			Object.assign(new Error("rate limited"), { status: 429 }),
		);
		await expect(processLlmsTxt(makeJob({ scanId: baseScan.id }))).rejects.toThrow("rate limited");
	});
});
