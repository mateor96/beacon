import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	mockGetById,
	mockUpdateAiAnalysis,
	mockUpdateCitationAnalysis,
	mockUpdateAnalysisStatus,
	mockAnalyzeSemantic,
	mockAnalyzeCitation,
	mockFromEnv,
	mockGetLocaleById,
	mockGetLocaleByCode,
	mockGetTemplate,
} = vi.hoisted(() => ({
	mockGetById: vi.fn(),
	mockUpdateAiAnalysis: vi.fn().mockResolvedValue(undefined),
	mockUpdateCitationAnalysis: vi.fn().mockResolvedValue(undefined),
	mockUpdateAnalysisStatus: vi.fn().mockResolvedValue(undefined),
	mockAnalyzeSemantic: vi.fn(),
	mockAnalyzeCitation: vi.fn(),
	mockFromEnv: vi.fn().mockReturnValue({}),
	mockGetLocaleById: vi.fn().mockResolvedValue(null),
	mockGetLocaleByCode: vi.fn().mockResolvedValue(null),
	mockGetTemplate: vi.fn().mockResolvedValue(null),
}));

vi.mock("@beacon/db", () => ({
	db: {},
	scanQueries: {
		getById: (...args: unknown[]) => mockGetById(...args),
		updateAiAnalysis: (...args: unknown[]) => mockUpdateAiAnalysis(...args),
		updateCitationAnalysis: (...args: unknown[]) => mockUpdateCitationAnalysis(...args),
		updateAnalysisStatus: (...args: unknown[]) => mockUpdateAnalysisStatus(...args),
	},
	localeQueries: {
		getLocaleById: (...args: unknown[]) => mockGetLocaleById(...args),
		getLocaleByCode: (...args: unknown[]) => mockGetLocaleByCode(...args),
		getTemplate: (...args: unknown[]) => mockGetTemplate(...args),
	},
}));

vi.mock("@beacon/ai", async () => {
	const real = await vi.importActual<typeof import("@beacon/ai")>("@beacon/ai");
	return {
		...real,
		ClaudeClient: { fromEnv: mockFromEnv },
		analyzeSemanticQuality: (...args: unknown[]) => mockAnalyzeSemantic(...args),
		analyzeCitationReadiness: (...args: unknown[]) => mockAnalyzeCitation(...args),
	};
});

import { processAnalysis } from "../processors/analysis.processor";

function makeJob(
	data: { scanId: string; type: "semantic" | "citation" },
	overrides?: { attemptsMade?: number; attempts?: number },
) {
	return {
		id: "analysis-job-1",
		data,
		attemptsMade: overrides?.attemptsMade ?? 1,
		opts: { attempts: overrides?.attempts ?? 2 },
		updateProgress: vi.fn(),
	} as unknown as Parameters<typeof processAnalysis>[0];
}

const baseScan = {
	id: "scan-1",
	url: "https://example.com",
	htmlContent: "<html><body>Content</body></html>",
};

describe("processAnalysis", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("semantic: calls analyzeSemanticQuality and updateAiAnalysis", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockAnalyzeSemantic.mockResolvedValue({
			ok: true,
			data: { overallScore: 80, summary: "Good" },
			usage: [],
		});

		const result = await processAnalysis(makeJob({ scanId: "scan-1", type: "semantic" }));

		expect(result).toEqual({ scanId: "scan-1", analysisComplete: true });
		expect(mockUpdateAnalysisStatus).toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			"semantic",
			"processing",
		);
		expect(mockUpdateAnalysisStatus).toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			"semantic",
			"completed",
		);
		expect(mockUpdateAiAnalysis).toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			expect.any(String),
		);
		expect(mockUpdateCitationAnalysis).not.toHaveBeenCalled();
	});

	it("citation: calls analyzeCitationReadiness and updateCitationAnalysis", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockAnalyzeCitation.mockResolvedValue({
			ok: true,
			data: { overallScore: 70, summary: "OK" },
			usage: [],
		});

		const result = await processAnalysis(makeJob({ scanId: "scan-1", type: "citation" }));

		expect(result).toEqual({ scanId: "scan-1", analysisComplete: true });
		expect(mockUpdateAnalysisStatus).toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			"citation",
			"processing",
		);
		expect(mockUpdateAnalysisStatus).toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			"citation",
			"completed",
		);
		expect(mockUpdateCitationAnalysis).toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			expect.any(String),
		);
		expect(mockUpdateAiAnalysis).not.toHaveBeenCalled();
	});

	it("throws if scan not found", async () => {
		mockGetById.mockResolvedValue(undefined);

		await expect(processAnalysis(makeJob({ scanId: "missing", type: "semantic" }))).rejects.toThrow(
			"Scan missing not found",
		);
	});

	it("throws if scan has no htmlContent", async () => {
		mockGetById.mockResolvedValue({ ...baseScan, htmlContent: null });

		await expect(processAnalysis(makeJob({ scanId: "scan-1", type: "semantic" }))).rejects.toThrow(
			"no htmlContent",
		);
	});

	it("persists failed status only on last attempt", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockAnalyzeSemantic.mockResolvedValue({
			ok: false,
			error: { code: "API_ERROR", message: "rate limited", attempts: 2 },
			usage: [],
		});

		// Last attempt (attemptsMade=1, attempts=2 → isLastAttempt true)
		await expect(
			processAnalysis(
				makeJob({ scanId: "scan-1", type: "semantic" }, { attemptsMade: 1, attempts: 2 }),
			),
		).rejects.toThrow("Semantic analysis failed: rate limited");
		expect(mockUpdateAnalysisStatus).toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			"semantic",
			"failed",
			"Semantic analysis failed: rate limited",
		);
	});

	it("does not persist failed status on non-final attempt", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockAnalyzeSemantic.mockResolvedValue({
			ok: false,
			error: { code: "API_ERROR", message: "rate limited", attempts: 2 },
			usage: [],
		});

		// First attempt (attemptsMade=0, attempts=2 → isLastAttempt false)
		await expect(
			processAnalysis(
				makeJob({ scanId: "scan-1", type: "semantic" }, { attemptsMade: 0, attempts: 2 }),
			),
		).rejects.toThrow("Semantic analysis failed: rate limited");
		// Should set processing but NOT failed
		expect(mockUpdateAnalysisStatus).toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			"semantic",
			"processing",
		);
		expect(mockUpdateAnalysisStatus).not.toHaveBeenCalledWith(
			expect.anything(),
			"scan-1",
			"semantic",
			"failed",
			expect.anything(),
		);
	});

	describe("locale-aware preamble (#479)", () => {
		beforeEach(async () => {
			const mod = await import("../lib/locale-prompt");
			mod.__resetLocalePromptCache();
			vi.clearAllMocks();
			mockFromEnv.mockReturnValue({});
		});

		it("semantic: prepends French preamble when scan.localeId is set", async () => {
			mockGetById.mockResolvedValue({ ...baseScan, localeId: "fr-uuid" });
			mockGetLocaleById.mockResolvedValue({
				id: "fr-uuid",
				countryCode: "FR",
				languageCode: "fr",
				displayName: "Francais",
				regionContext: null,
				isActive: 1,
			});
			mockGetTemplate.mockResolvedValueOnce({
				id: "t",
				localeId: "fr-uuid",
				key: "readiness_check",
				category: "system",
				content: "PREAMBLE_FR language={{language}}",
				variables: [],
				version: 1,
			});
			mockAnalyzeSemantic.mockResolvedValue({
				ok: true,
				data: { overallScore: 80 },
				usage: [],
			});

			await processAnalysis(makeJob({ scanId: "scan-1", type: "semantic" }));

			expect(mockAnalyzeSemantic).toHaveBeenCalled();
			const [, , , options] = mockAnalyzeSemantic.mock.calls[0] ?? [];
			expect(options?.systemPromptOverride).toContain("PREAMBLE_FR language=fr");
			// JSON-schema core MUST remain intact below the preamble.
			expect(options?.systemPromptOverride).toContain("overallScore");
			expect(options?.systemPromptOverride).toContain("Bewerte streng");
		});

		it("semantic: null localeId → default prompt (no preamble), schema intact", async () => {
			mockGetById.mockResolvedValue({ ...baseScan, localeId: null });
			mockAnalyzeSemantic.mockResolvedValue({
				ok: true,
				data: { overallScore: 80 },
				usage: [],
			});

			await processAnalysis(makeJob({ scanId: "scan-1", type: "semantic" }));

			const [, , , options] = mockAnalyzeSemantic.mock.calls[0] ?? [];
			// Preamble empty → buildSemanticPrompt returns the core prompt as-is.
			expect(options?.systemPromptOverride).toContain("overallScore");
			expect(options?.systemPromptOverride).not.toContain("PREAMBLE_FR");
		});

		it("citation: locale preamble is prepended, core citation schema preserved", async () => {
			mockGetById.mockResolvedValue({ ...baseScan, localeId: "fr-uuid" });
			mockGetLocaleById.mockResolvedValue({
				id: "fr-uuid",
				countryCode: "FR",
				languageCode: "fr",
				displayName: "Francais",
				regionContext: null,
				isActive: 1,
			});
			mockGetTemplate.mockResolvedValueOnce({
				id: "t",
				localeId: "fr-uuid",
				key: "readiness_check",
				category: "system",
				content: "CITE_PREAMBLE language={{language}}",
				variables: [],
				version: 1,
			});
			mockAnalyzeCitation.mockResolvedValue({
				ok: true,
				data: { overallScore: 70 },
				usage: [],
			});

			await processAnalysis(makeJob({ scanId: "scan-1", type: "citation" }));

			const [, , , options] = mockAnalyzeCitation.mock.calls[0] ?? [];
			expect(options?.systemPromptOverride).toContain("CITE_PREAMBLE language=fr");
			expect(options?.systemPromptOverride).toContain("quotability");
		});
	});
});
