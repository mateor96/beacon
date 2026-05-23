import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted to avoid TDZ issues) ─────────────────────

const {
	mockUpdateStatus,
	mockUpdateResults,
	mockGetById,
	mockFetchUrl,
	mockScan,
	mockFindProjectByUserAndUrl,
	mockHasBaselineSnapshot,
	mockCreateBaselineSnapshot,
} = vi.hoisted(() => ({
	mockUpdateStatus: vi.fn().mockResolvedValue(undefined),
	mockUpdateResults: vi.fn().mockResolvedValue(undefined),
	mockGetById: vi.fn(),
	mockFetchUrl: vi.fn(),
	mockScan: vi.fn(),
	mockFindProjectByUserAndUrl: vi.fn().mockResolvedValue(undefined),
	mockHasBaselineSnapshot: vi.fn().mockResolvedValue(undefined),
	mockCreateBaselineSnapshot: vi.fn().mockResolvedValue({ id: "snapshot-1" }),
}));

vi.mock("@beacon/db", () => ({
	db: {},
	scanQueries: {
		getById: (...args: unknown[]) => mockGetById(...args),
		updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
		updateResults: (...args: unknown[]) => mockUpdateResults(...args),
	},
	roiQueries: {
		findProjectByUserAndUrl: (...args: unknown[]) => mockFindProjectByUserAndUrl(...args),
		hasBaselineSnapshot: (...args: unknown[]) => mockHasBaselineSnapshot(...args),
		createBaselineSnapshot: (...args: unknown[]) => mockCreateBaselineSnapshot(...args),
	},
}));

vi.mock("@beacon/scanner", async () => {
	const { FetchError } = await vi.importActual<typeof import("@beacon/scanner")>("@beacon/scanner");
	return {
		FetchError,
		fetchUrl: (...args: unknown[]) => mockFetchUrl(...args),
		ScannerEngine: vi.fn().mockImplementation(() => ({
			scan: (...args: unknown[]) => mockScan(...args),
		})),
	};
});

import { FetchError } from "@beacon/scanner";
import type { ScanResult } from "@beacon/shared";
import { processScan } from "../processors/scan.processor";

// ── Helpers ──────────────────────────────────────────────────

function makeJob(
	data: { scanId: string; url: string },
	overrides?: { attemptsMade?: number; attempts?: number },
) {
	return {
		id: "test-job-1",
		data,
		opts: { attempts: overrides?.attempts ?? 3 },
		attemptsMade: overrides?.attemptsMade ?? 0,
		updateProgress: vi.fn(),
	} as Parameters<typeof processScan>[0];
}

const defaultFetchResult = {
	html: "<html><body>Hello</body></html>",
	statusCode: 200,
	responseTime: 150,
	redirects: [],
	finalUrl: "https://example.com",
};

const defaultScanResult: ScanResult = {
	id: "scan-uuid",
	url: "https://example.com",
	finalUrl: "https://example.com",
	status: "completed",
	overallScore: 75,
	readinessLevel: 3,
	levelScores: { readability: 80, interactivity: 70, transactional: 60 },
	checks: [],
	createdAt: "2025-01-01T00:00:00.000Z",
	completedAt: "2025-01-01T00:00:01.000Z",
};

// ── Tests ────────────────────────────────────────────────────

describe("processScan", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetById.mockResolvedValue({ id: "scan-1", url: "https://example.com", status: "pending" });
	});

	it("happy path: fetches, scans, persists results, returns score", async () => {
		mockFetchUrl.mockResolvedValue(defaultFetchResult);
		mockScan.mockResolvedValue(defaultScanResult);

		const result = await processScan(makeJob({ scanId: "scan-1", url: "https://example.com" }));

		// Sets status to processing
		expect(mockUpdateStatus).toHaveBeenCalledWith(expect.anything(), "scan-1", "processing");

		// Persists results
		expect(mockUpdateResults).toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			expect.objectContaining({
				score: 75,
				readinessLevel: 3,
				htmlContent: defaultFetchResult.html,
			}),
		);

		// Sets status to completed
		expect(mockUpdateStatus).toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			"completed",
			undefined,
			expect.any(Number),
		);

		// Returns expected result
		expect(result).toEqual({
			scanId: "scan-1",
			overallScore: 75,
			readinessLevel: 3,
		});
	});

	it("FetchError: marks scan as failed gracefully without throwing", async () => {
		mockFetchUrl.mockRejectedValue(new FetchError("DNS resolution failed", "FETCH_FAILED"));

		const result = await processScan(
			makeJob({ scanId: "scan-2", url: "https://unreachable.invalid" }),
		);

		expect(result).toEqual({
			scanId: "scan-2",
			overallScore: 0,
			readinessLevel: 0,
		});

		// Status set to failed with error message
		expect(mockUpdateStatus).toHaveBeenCalledWith(
			expect.anything(),
			"scan-2",
			"failed",
			"DNS resolution failed",
			expect.any(Number),
		);

		// Engine.scan() never called
		expect(mockScan).not.toHaveBeenCalled();
	});

	it("unexpected fetch error on final attempt: writes failed status and re-throws", async () => {
		mockFetchUrl.mockRejectedValue(new TypeError("fetch failed"));

		await expect(
			processScan(
				makeJob({ scanId: "scan-3", url: "https://example.com" }, { attemptsMade: 2, attempts: 3 }),
			),
		).rejects.toThrow("fetch failed");

		// DB marked as failed on final attempt
		expect(mockUpdateStatus).toHaveBeenCalledWith(
			expect.anything(),
			"scan-3",
			"failed",
			"fetch failed",
			expect.any(Number),
		);
	});

	it("unexpected fetch error on non-final attempt: does NOT write failed status", async () => {
		mockFetchUrl.mockRejectedValue(new TypeError("fetch failed"));

		await expect(
			processScan(
				makeJob(
					{ scanId: "scan-3b", url: "https://example.com" },
					{ attemptsMade: 0, attempts: 3 },
				),
			),
		).rejects.toThrow("fetch failed");

		// Status should only have been set to "processing", NOT "failed"
		expect(mockUpdateStatus).toHaveBeenCalledWith(expect.anything(), "scan-3b", "processing");
		expect(mockUpdateStatus).not.toHaveBeenCalledWith(
			expect.anything(),
			"scan-3b",
			"failed",
			expect.any(String),
			expect.any(Number),
		);
	});

	it("scanner internal failure on final attempt: writes failed status", async () => {
		mockFetchUrl.mockResolvedValue(defaultFetchResult);
		mockScan.mockResolvedValue({
			...defaultScanResult,
			status: "failed",
			error: "No check plugins registered",
		});

		await expect(
			processScan(
				makeJob({ scanId: "scan-4", url: "https://example.com" }, { attemptsMade: 1, attempts: 2 }),
			),
		).rejects.toThrow("Scanner internal failure: No check plugins registered");

		// DB marked as failed on final attempt
		expect(mockUpdateStatus).toHaveBeenCalledWith(
			expect.anything(),
			"scan-4",
			"failed",
			expect.stringContaining("Scanner internal failure"),
			expect.any(Number),
		);
	});

	it("scanner internal failure on non-final attempt: does NOT write failed status", async () => {
		mockFetchUrl.mockResolvedValue(defaultFetchResult);
		mockScan.mockResolvedValue({
			...defaultScanResult,
			status: "failed",
			error: "No check plugins registered",
		});

		await expect(
			processScan(
				makeJob(
					{ scanId: "scan-4b", url: "https://example.com" },
					{ attemptsMade: 0, attempts: 3 },
				),
			),
		).rejects.toThrow("Scanner internal failure: No check plugins registered");

		// Only "processing" was set, not "failed"
		expect(mockUpdateStatus).toHaveBeenCalledWith(expect.anything(), "scan-4b", "processing");
		expect(mockUpdateStatus).not.toHaveBeenCalledWith(
			expect.anything(),
			"scan-4b",
			"failed",
			expect.any(String),
			expect.any(Number),
		);
	});

	it("DB error during failure update is caught and does not mask original error", async () => {
		mockFetchUrl.mockRejectedValue(new TypeError("network error"));
		mockUpdateStatus
			.mockResolvedValueOnce(undefined) // processing
			.mockRejectedValueOnce(new Error("DB connection lost")); // failed update

		await expect(
			processScan(
				makeJob({ scanId: "scan-5", url: "https://example.com" }, { attemptsMade: 2, attempts: 3 }),
			),
		).rejects.toThrow("network error");
	});

	it("calls fetchUrl with the job URL and passes prefetchedResult to engine", async () => {
		mockFetchUrl.mockResolvedValue(defaultFetchResult);
		mockScan.mockResolvedValue(defaultScanResult);

		await processScan(makeJob({ scanId: "scan-6", url: "https://test.example.com" }));

		expect(mockFetchUrl).toHaveBeenCalledWith("https://test.example.com");
		expect(mockScan).toHaveBeenCalledWith("https://test.example.com", {
			prefetchedResult: defaultFetchResult,
		});
	});

	// ── Baseline snapshot tests removed ────────────────────────
	// The per-user monitoring-project baseline path was removed when auth
	// was archived; the scan processor no longer calls roiQueries. The
	// mocks are kept so the @beacon/db vi.mock surface stays complete.

	it("throws if scan row not found", async () => {
		mockGetById.mockResolvedValue(undefined);

		await expect(
			processScan(makeJob({ scanId: "scan-missing", url: "https://example.com" })),
		).rejects.toThrow("Scan scan-missing not found");

		// No fetch or scan work done
		expect(mockFetchUrl).not.toHaveBeenCalled();
		expect(mockScan).not.toHaveBeenCalled();
	});
});
