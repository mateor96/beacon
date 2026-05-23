import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	mockGetById,
	mockUpdateReportTexts,
	mockGenerateReportTexts,
	mockGenerateReport,
	mockFromEnv,
	mockMkdir,
	mockWriteFile,
	mockUpdateReportStatus,
} = vi.hoisted(() => ({
	mockGetById: vi.fn(),
	mockUpdateReportTexts: vi.fn().mockResolvedValue(undefined),
	mockGenerateReportTexts: vi.fn(),
	mockGenerateReport: vi.fn(),
	mockFromEnv: vi.fn().mockReturnValue({}),
	mockMkdir: vi.fn().mockResolvedValue(undefined),
	mockWriteFile: vi.fn().mockResolvedValue(undefined),
	mockUpdateReportStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:fs/promises", () => ({
	mkdir: (...args: unknown[]) => mockMkdir(...args),
	writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

vi.mock("@beacon/db", () => ({
	db: {},
	scanQueries: {
		getById: (...args: unknown[]) => mockGetById(...args),
		updateReportTexts: (...args: unknown[]) => mockUpdateReportTexts(...args),
		updateReportStatus: (...args: unknown[]) => mockUpdateReportStatus(...args),
	},
}));

vi.mock("@beacon/ai", () => ({
	ClaudeClient: { fromEnv: mockFromEnv },
	generateReportTexts: (...args: unknown[]) => mockGenerateReportTexts(...args),
}));

vi.mock("@beacon/report", () => ({
	generateReport: (...args: unknown[]) => mockGenerateReport(...args),
}));

import { processReport } from "../processors/report.processor";

function makeJob(data: { scanId: string; format: "pdf"; regenerate?: boolean }) {
	return {
		id: "report-job-1",
		data,
		opts: { attempts: 1 },
		attemptsMade: 0,
		updateProgress: vi.fn(),
	} as Parameters<typeof processReport>[0];
}

const mockReportTexts = {
	executiveSummary: "Summary",
	checkSummaries: {},
	categoryAssessments: {
		readability: { title: "R", summary: "Good readability", score: 80 },
		interactivity: { title: "I", summary: "OK interactivity", score: 60 },
		transactional: { title: "T", summary: "Needs work", score: 40 },
	},
	recommendations: [
		{ priority: 1, title: "Fix it", description: "Do this", impact: "high" as const },
	],
	conclusion: "Done",
};

const baseScan = {
	id: "scan-1",
	url: "https://example.com",
	finalUrl: "https://example.com",
	status: "completed",
	score: 75,
	readinessLevel: 3,
	levelScores: { readability: 80, interactivity: 70, transactional: 60 },
	checks: [],
	scannedAt: new Date("2025-01-01"),
	htmlContent: "<html>test</html>",
	reportTexts: null,
};

describe("processReport", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGenerateReport.mockResolvedValue({
			html: "<html>report</html>",
			pdf: Buffer.from("pdf-data"),
			metadata: { generatedAt: "2025-01-01", pageCount: 3, fileSizeBytes: 1024 },
		});
	});

	it("generates report texts when not cached, writes PDF", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateReportTexts.mockResolvedValue({
			ok: true,
			data: mockReportTexts,
			usage: [],
		});

		const result = await processReport(makeJob({ scanId: "scan-1", format: "pdf" }));

		expect(result).toEqual({ scanId: "scan-1", generatedAt: "2025-01-01", fileSizeBytes: 1024 });
		expect(mockGenerateReportTexts).toHaveBeenCalled();
		expect(mockUpdateReportTexts).toHaveBeenCalled();
		expect(mockMkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
		expect(mockWriteFile).toHaveBeenCalled();
		expect(mockGenerateReport).toHaveBeenCalledWith(
			expect.objectContaining({
				url: "https://example.com",
				reportTexts: expect.objectContaining({
					executiveSummary: "Summary",
					categoryAssessments: expect.objectContaining({
						readability: "Good readability",
					}),
				}),
			}),
		);
	});

	it("uses cached reportTexts when available", async () => {
		mockGetById.mockResolvedValue({ ...baseScan, reportTexts: mockReportTexts });

		const result = await processReport(makeJob({ scanId: "scan-1", format: "pdf" }));

		expect(result.scanId).toBe("scan-1");
		expect(mockGenerateReportTexts).not.toHaveBeenCalled();
		expect(mockUpdateReportTexts).not.toHaveBeenCalled();
	});

	it("throws if scan not found and marks failed on last attempt", async () => {
		mockGetById.mockResolvedValue(undefined);

		await expect(processReport(makeJob({ scanId: "missing", format: "pdf" }))).rejects.toThrow(
			"Scan missing not found",
		);

		expect(mockUpdateReportStatus).toHaveBeenCalledWith(expect.anything(), "missing", "failed", {
			error: "Scan missing not found",
		});
	});

	it("throws on report text generation failure", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateReportTexts.mockResolvedValue({
			ok: false,
			error: { code: "API_ERROR", message: "timeout", attempts: 2 },
			usage: [],
		});

		await expect(processReport(makeJob({ scanId: "scan-1", format: "pdf" }))).rejects.toThrow(
			"Report text generation failed: timeout",
		);
	});

	it("sets status to processing at start", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateReportTexts.mockResolvedValue({
			ok: true,
			data: mockReportTexts,
			usage: [],
		});

		await processReport(makeJob({ scanId: "scan-1", format: "pdf" }));

		expect(mockUpdateReportStatus).toHaveBeenCalledWith(expect.anything(), "scan-1", "processing", {
			jobId: "report-job-1",
		});
	});

	it("sets status to completed with generatedAt and fileSizeBytes", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateReportTexts.mockResolvedValue({
			ok: true,
			data: mockReportTexts,
			usage: [],
		});

		await processReport(makeJob({ scanId: "scan-1", format: "pdf" }));

		expect(mockUpdateReportStatus).toHaveBeenCalledWith(expect.anything(), "scan-1", "completed", {
			generatedAt: new Date("2025-01-01"),
			fileSizeBytes: 1024,
		});
	});

	it("sets status to failed on last attempt", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateReportTexts.mockResolvedValue({
			ok: false,
			error: { code: "API_ERROR", message: "timeout", attempts: 2 },
			usage: [],
		});

		const job = {
			id: "report-job-1",
			data: { scanId: "scan-1", format: "pdf" as const },
			opts: { attempts: 1 },
			attemptsMade: 0,
			updateProgress: vi.fn(),
		} as unknown as Parameters<typeof processReport>[0];

		await expect(processReport(job)).rejects.toThrow();

		expect(mockUpdateReportStatus).toHaveBeenCalledWith(expect.anything(), "scan-1", "failed", {
			error: "Report text generation failed: timeout",
		});
	});

	it("leaves status as processing on non-last attempt", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateReportTexts.mockResolvedValue({
			ok: false,
			error: { code: "API_ERROR", message: "timeout", attempts: 1 },
			usage: [],
		});

		const job = {
			id: "report-job-1",
			data: { scanId: "scan-1", format: "pdf" as const },
			opts: { attempts: 3 },
			attemptsMade: 0,
			updateProgress: vi.fn(),
		} as unknown as Parameters<typeof processReport>[0];

		await expect(processReport(job)).rejects.toThrow();

		// Should have been called with "processing" but NOT "failed"
		const failedCalls = mockUpdateReportStatus.mock.calls.filter(
			(call: unknown[]) => call[2] === "failed",
		);
		expect(failedCalls).toHaveLength(0);
	});

	it("marks failed when getById throws on last attempt", async () => {
		mockGetById.mockRejectedValue(new Error("DB connection lost"));

		await expect(processReport(makeJob({ scanId: "scan-1", format: "pdf" }))).rejects.toThrow(
			"DB connection lost",
		);

		expect(mockUpdateReportStatus).toHaveBeenCalledWith(expect.anything(), "scan-1", "failed", {
			error: "DB connection lost",
		});
	});

	it("marks failed when updateReportStatus('processing') throws on last attempt", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockUpdateReportStatus
			.mockRejectedValueOnce(new Error("DB write failed"))
			.mockResolvedValueOnce(undefined);

		await expect(processReport(makeJob({ scanId: "scan-1", format: "pdf" }))).rejects.toThrow(
			"DB write failed",
		);

		expect(mockUpdateReportStatus).toHaveBeenCalledWith(expect.anything(), "scan-1", "failed", {
			error: "DB write failed",
		});
	});

	it("still throws original error when persisting failure status fails", async () => {
		mockGetById.mockRejectedValue(new Error("original error"));
		mockUpdateReportStatus.mockRejectedValue(new Error("DB also down"));

		await expect(processReport(makeJob({ scanId: "scan-1", format: "pdf" }))).rejects.toThrow(
			"original error",
		);
	});

	it("does not mark failed on non-last attempt when getById throws", async () => {
		mockGetById.mockRejectedValue(new Error("DB connection lost"));

		const job = {
			id: "report-job-1",
			data: { scanId: "scan-1", format: "pdf" as const },
			opts: { attempts: 3 },
			attemptsMade: 0,
			updateProgress: vi.fn(),
		} as unknown as Parameters<typeof processReport>[0];

		await expect(processReport(job)).rejects.toThrow("DB connection lost");

		const failedCalls = mockUpdateReportStatus.mock.calls.filter(
			(call: unknown[]) => call[2] === "failed",
		);
		expect(failedCalls).toHaveLength(0);
	});

	it("bypasses cached reportTexts when regenerate is true", async () => {
		mockUpdateReportStatus.mockResolvedValue(undefined);
		mockGetById.mockResolvedValue({ ...baseScan, reportTexts: mockReportTexts });
		mockGenerateReportTexts.mockResolvedValue({
			ok: true,
			data: mockReportTexts,
			usage: [],
		});

		const result = await processReport(
			makeJob({ scanId: "scan-1", format: "pdf", regenerate: true }),
		);

		expect(result.scanId).toBe("scan-1");
		expect(mockGenerateReportTexts).toHaveBeenCalled();
		expect(mockUpdateReportTexts).toHaveBeenCalled();
	});
});
