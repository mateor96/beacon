import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted to avoid TDZ issues) ─────────────────────

const { mockGetRequestById, mockUpdateRequestStatus, mockCreateResult, mockFetchUrl, mockScan } =
	vi.hoisted(() => ({
		mockGetRequestById: vi.fn(),
		mockUpdateRequestStatus: vi.fn().mockResolvedValue(undefined),
		mockCreateResult: vi.fn().mockResolvedValue(undefined),
		mockFetchUrl: vi.fn(),
		mockScan: vi.fn(),
	}));

vi.mock("@beacon/db", () => ({
	db: {},
	publicAuditQueries: {
		getRequestById: (...args: unknown[]) => mockGetRequestById(...args),
		updateRequestStatus: (...args: unknown[]) => mockUpdateRequestStatus(...args),
		createResult: (...args: unknown[]) => mockCreateResult(...args),
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
		defaultRegistry: {
			get: vi.fn().mockReturnValue({ id: "mock-check", run: vi.fn() }),
		},
		CheckRegistry: vi.fn().mockImplementation(() => ({
			register: vi.fn(),
			get: vi.fn(),
		})),
	};
});

import { FetchError } from "@beacon/scanner";
import type { ScanResult } from "@beacon/shared";
import { processPublicAudit } from "../processors/public-audit.processor";

// ── Helpers ──────────────────────────────────────────────────

function makeJob(
	data: { requestId: string; url: string } = { requestId: "req-1", url: "https://example.com" },
	overrides?: { attemptsMade?: number; attempts?: number },
) {
	return {
		id: "test-job-1",
		data,
		opts: { attempts: overrides?.attempts ?? 3 },
		attemptsMade: overrides?.attemptsMade ?? 0,
		updateProgress: vi.fn(),
	} as Parameters<typeof processPublicAudit>[0];
}

const defaultFetchResult = {
	html: "<html><body>Hello</body></html>",
	statusCode: 200,
	responseTime: 150,
	redirects: [],
	finalUrl: "https://example.com",
};

const defaultChecks: ScanResult["checks"] = [
	{
		id: "llms-txt",
		name: "LLMs.txt",
		status: "pass",
		category: "readability",
		severity: "critical",
		score: 90,
		summary: "llms.txt found",
		issues: [],
	},
	{
		id: "robots-txt",
		name: "Robots.txt",
		status: "warn",
		category: "readability",
		severity: "major",
		score: 60,
		summary: "Robots.txt partially configured",
		issues: [],
	},
	{
		id: "schema-org",
		name: "Schema.org",
		status: "fail",
		category: "readability",
		severity: "minor",
		score: 20,
		summary: "No structured data found",
		issues: [],
	},
];

const defaultScanResult: ScanResult = {
	id: "scan-uuid",
	url: "https://example.com",
	finalUrl: "https://example.com",
	status: "completed",
	overallScore: 75,
	readinessLevel: 3,
	levelScores: { readability: 80, interactivity: 70, transactional: 60 },
	checks: defaultChecks,
	createdAt: "2025-01-01T00:00:00.000Z",
	completedAt: "2025-01-01T00:00:01.000Z",
};

// ── Tests ────────────────────────────────────────────────────

describe("processPublicAudit", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetRequestById.mockResolvedValue({
			id: "req-1",
			url: "https://example.com",
			status: "pending",
			ipHash: "abc123",
		});
	});

	// ── Happy path ──────────────────────────────────────────

	it("fetches URL, runs scan, stores result, updates status to completed, returns { requestId, overallScore }", async () => {
		mockFetchUrl.mockResolvedValue(defaultFetchResult);
		mockScan.mockResolvedValue(defaultScanResult);

		const result = await processPublicAudit(makeJob());

		// Persists result
		expect(mockCreateResult).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				requestId: "req-1",
				overallScore: 75,
			}),
		);

		// Sets status to completed
		expect(mockUpdateRequestStatus).toHaveBeenCalledWith(expect.anything(), "req-1", "completed");

		// Returns expected result
		expect(result).toEqual({
			requestId: "req-1",
			overallScore: 75,
		});
	});

	it("calls updateRequestStatus with 'processing' before scan", async () => {
		mockFetchUrl.mockResolvedValue(defaultFetchResult);
		mockScan.mockResolvedValue(defaultScanResult);

		await processPublicAudit(makeJob());

		// First call should be "processing"
		const statusCalls = mockUpdateRequestStatus.mock.calls;
		expect(statusCalls[0]).toEqual([expect.anything(), "req-1", "processing"]);
	});

	it("maps check results to modelScores JSONB (array of { checkId, name, score, status, summary })", async () => {
		mockFetchUrl.mockResolvedValue(defaultFetchResult);
		mockScan.mockResolvedValue(defaultScanResult);

		await processPublicAudit(makeJob());

		const createResultCall = mockCreateResult.mock.calls[0];
		const resultData = createResultCall[1];

		expect(resultData.modelScores).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					checkId: "llms-txt",
					name: "LLMs.txt",
					score: 90,
					status: "pass",
					summary: "llms.txt found",
				}),
				expect.objectContaining({
					checkId: "robots-txt",
					name: "Robots.txt",
					score: 60,
					status: "warn",
					summary: "Robots.txt partially configured",
				}),
				expect.objectContaining({
					checkId: "schema-org",
					name: "Schema.org",
					score: 20,
					status: "fail",
					summary: "No structured data found",
				}),
			]),
		);

		expect(resultData.modelScores).toHaveLength(3);
	});

	// ── Fetch failures ──────────────────────────────────────

	it("FetchError: marks request as failed, returns overallScore 0, does NOT throw", async () => {
		mockFetchUrl.mockRejectedValue(new FetchError("DNS resolution failed", "FETCH_FAILED"));

		const result = await processPublicAudit(
			makeJob({ requestId: "req-1", url: "https://unreachable.invalid" }),
		);

		expect(result).toEqual({
			requestId: "req-1",
			overallScore: 0,
		});

		// Status set to failed
		expect(mockUpdateRequestStatus).toHaveBeenCalledWith(expect.anything(), "req-1", "failed");

		// Engine.scan() never called
		expect(mockScan).not.toHaveBeenCalled();
	});

	it("non-FetchError on final attempt: updates status to 'failed' and re-throws", async () => {
		mockFetchUrl.mockRejectedValue(new TypeError("fetch failed"));

		await expect(
			processPublicAudit(
				makeJob(
					{ requestId: "req-1", url: "https://example.com" },
					{ attemptsMade: 2, attempts: 3 },
				),
			),
		).rejects.toThrow("fetch failed");

		// DB marked as failed on final attempt
		expect(mockUpdateRequestStatus).toHaveBeenCalledWith(expect.anything(), "req-1", "failed");
	});

	// ── Edge cases ──────────────────────────────────────────

	it("request not found in DB: throws error", async () => {
		mockGetRequestById.mockResolvedValue(undefined);

		await expect(
			processPublicAudit(makeJob({ requestId: "req-missing", url: "https://example.com" })),
		).rejects.toThrow(/req-missing/);

		// No fetch or scan work done
		expect(mockFetchUrl).not.toHaveBeenCalled();
		expect(mockScan).not.toHaveBeenCalled();
	});

	it("scanner returns completed with some checks in error status: still stores result and completes", async () => {
		const checksWithError: ScanResult["checks"] = [
			...defaultChecks,
			{
				id: "meta-tags",
				name: "Meta Tags",
				status: "error",
				category: "readability",
				severity: "major",
				score: 0,
				summary: "Check failed due to timeout",
				issues: [],
			},
		];

		mockFetchUrl.mockResolvedValue(defaultFetchResult);
		mockScan.mockResolvedValue({
			...defaultScanResult,
			checks: checksWithError,
		});

		const result = await processPublicAudit(makeJob());

		// Still creates result
		expect(mockCreateResult).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				requestId: "req-1",
				overallScore: 75,
			}),
		);

		// Still marks as completed
		expect(mockUpdateRequestStatus).toHaveBeenCalledWith(expect.anything(), "req-1", "completed");

		expect(result).toEqual({
			requestId: "req-1",
			overallScore: 75,
		});
	});

	it("generates correct German summary text based on score level", async () => {
		mockFetchUrl.mockResolvedValue(defaultFetchResult);
		mockScan.mockResolvedValue(defaultScanResult);

		await processPublicAudit(makeJob());

		const createResultCall = mockCreateResult.mock.calls[0];
		const resultData = createResultCall[1];

		// Score is 75 → mid-tier summary
		expect(resultData.summary).toContain("Optimierungspotenzial");
		expect(resultData.summary).toContain("75/100");
		// 1 pass out of 3 checks
		expect(resultData.summary).toContain("1/3 Checks bestanden");
	});

	// ── Worker lifecycle ────────────────────────────────────

	it("non-final attempt error: re-throws WITHOUT setting status to failed (allows retry)", async () => {
		mockFetchUrl.mockRejectedValue(new TypeError("fetch failed"));

		await expect(
			processPublicAudit(
				makeJob(
					{ requestId: "req-1", url: "https://example.com" },
					{ attemptsMade: 0, attempts: 3 },
				),
			),
		).rejects.toThrow("fetch failed");

		// Status should only have been set to "processing", NOT "failed"
		expect(mockUpdateRequestStatus).toHaveBeenCalledWith(expect.anything(), "req-1", "processing");
		expect(mockUpdateRequestStatus).not.toHaveBeenCalledWith(expect.anything(), "req-1", "failed");
	});

	it("final attempt error: sets status to 'failed' AND re-throws", async () => {
		mockFetchUrl.mockRejectedValue(new TypeError("network error"));

		await expect(
			processPublicAudit(
				makeJob(
					{ requestId: "req-1", url: "https://example.com" },
					{ attemptsMade: 2, attempts: 3 },
				),
			),
		).rejects.toThrow("network error");

		// Status set to "failed" on final attempt
		expect(mockUpdateRequestStatus).toHaveBeenCalledWith(expect.anything(), "req-1", "failed");
	});
});
