import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted Mocks ──────────────────────────────────────────

const {
	mockGetBaselineSnapshot,
	mockGetLatestSnapshot,
	mockGetSnapshotsForProject,
	mockGetMilestonesForProject,
	mockGetCitationsForProject,
	mockCreateRoiReport,
	mockGetProjectById,
	mockGetById,
	mockFromEnv,
	mockGenerateRoiReportTexts,
	mockRenderRoiHtml,
	mockRenderPdf,
	mockAddJob,
	mockMkdir,
	mockWriteFile,
} = vi.hoisted(() => ({
	mockGetBaselineSnapshot: vi.fn(),
	mockGetLatestSnapshot: vi.fn(),
	mockGetSnapshotsForProject: vi.fn(),
	mockGetMilestonesForProject: vi.fn(),
	mockGetCitationsForProject: vi.fn(),
	mockCreateRoiReport: vi.fn(),
	mockGetProjectById: vi.fn(),
	mockGetById: vi.fn(),
	mockFromEnv: vi.fn().mockReturnValue({}),
	mockGenerateRoiReportTexts: vi.fn(),
	mockRenderRoiHtml: vi.fn(),
	mockRenderPdf: vi.fn(),
	mockAddJob: vi.fn(),
	mockMkdir: vi.fn().mockResolvedValue(undefined),
	mockWriteFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:fs/promises", () => ({
	mkdir: (...args: unknown[]) => mockMkdir(...args),
	writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

vi.mock("@beacon/db", () => ({
	db: {},
	roiQueries: {
		getBaselineSnapshot: (...args: unknown[]) => mockGetBaselineSnapshot(...args),
		getLatestSnapshot: (...args: unknown[]) => mockGetLatestSnapshot(...args),
		getSnapshotsForProject: (...args: unknown[]) => mockGetSnapshotsForProject(...args),
		getMilestonesForProject: (...args: unknown[]) => mockGetMilestonesForProject(...args),
		getCitationsForProject: (...args: unknown[]) => mockGetCitationsForProject(...args),
		createRoiReport: (...args: unknown[]) => mockCreateRoiReport(...args),
	},
	monitoringQueries: {
		getProjectById: (...args: unknown[]) => mockGetProjectById(...args),
	},
	profileQueries: {
		getById: (...args: unknown[]) => mockGetById(...args),
	},
}));

vi.mock("@beacon/ai", () => ({
	ClaudeClient: { fromEnv: mockFromEnv },
	generateRoiReportTexts: (...args: unknown[]) => mockGenerateRoiReportTexts(...args),
}));

vi.mock("@beacon/report", () => ({
	renderRoiHtml: (...args: unknown[]) => mockRenderRoiHtml(...args),
	renderPdf: (...args: unknown[]) => mockRenderPdf(...args),
}));

vi.mock("@beacon/queue", () => ({
	addJob: (...args: unknown[]) => mockAddJob(...args),
}));

vi.mock("@beacon/notifications", () => ({
	templates: {
		"roi-report-ready": vi.fn().mockReturnValue({
			subject: "ROI Report Ready",
			html: "<p>report</p>",
			text: "report",
		}),
	},
	mintUnsubscribeToken: vi.fn().mockReturnValue("unsub-token"),
}));

import { processRoiReport } from "../processors/roi-report.processor";

// ── Fixtures ───────────────────────────────────────────────

const PROJECT_ID = "proj-001";
const REPORT_ID = "report-001";

const baselineSnapshot = {
	id: "snap-baseline",
	projectId: PROJECT_ID,
	overallScore: 40,
	readinessLevel: 1,
	subScores: { readability: 50, interactivity: 30, transactional: 20 },
	aiCitationCount: 2,
	createdAt: new Date("2026-01-01"),
};

const latestSnapshot = {
	id: "snap-latest",
	projectId: PROJECT_ID,
	overallScore: 72,
	readinessLevel: 2,
	subScores: { readability: 80, interactivity: 55, transactional: 45 },
	aiCitationCount: 8,
	createdAt: new Date("2026-04-01"),
};

const allSnapshots = [
	{ ...baselineSnapshot },
	{ overallScore: 55, createdAt: new Date("2026-02-01") },
	{ ...latestSnapshot },
];

const milestones = [
	{
		milestoneType: "score-jump",
		milestoneData: { description: "Score jumped by 15 points" },
		triggeredAt: new Date("2026-02-15"),
	},
];

const citations = [
	{ platform: "chatgpt", count: 5 },
	{ platform: "perplexity", count: 3 },
];

const mockAiTexts = {
	executiveSummary: "Great progress since baseline.",
	recommendations: [
		{
			priority: 1,
			title: "Add Schema.org",
			description: "Improve markup",
			impact: "high" as const,
		},
	],
	outlook: "Continue improving readability.",
};

function makeJob(overrides: Partial<{ projectId: string; branding?: unknown }> = {}) {
	return {
		id: "roi-job-1",
		data: {
			projectId: PROJECT_ID,
			format: "pdf" as const,
			...overrides,
		},
		opts: { attempts: 1 },
		attemptsMade: 0,
		updateProgress: vi.fn(),
	} as Parameters<typeof processRoiReport>[0];
}

function setupHappyPath() {
	mockGetBaselineSnapshot.mockResolvedValue(baselineSnapshot);
	mockGetLatestSnapshot.mockResolvedValue(latestSnapshot);
	mockGetSnapshotsForProject.mockResolvedValue(allSnapshots);
	mockGetMilestonesForProject.mockResolvedValue(milestones);
	mockGetCitationsForProject.mockResolvedValue(citations);
	mockGenerateRoiReportTexts.mockResolvedValue({
		ok: true,
		data: mockAiTexts,
		usage: [],
	});
	mockRenderRoiHtml.mockReturnValue("<html>roi report</html>");
	mockRenderPdf.mockResolvedValue({
		pdf: Buffer.from("pdf-bytes"),
		pageCount: 2,
	});
	mockCreateRoiReport.mockResolvedValue({ id: REPORT_ID });
	mockGetProjectById.mockResolvedValue({ id: PROJECT_ID, userId: "user-1", name: "Test Project" });
	mockGetById.mockResolvedValue({ id: "user-1", email: "user@example.com" });
	mockAddJob.mockResolvedValue(undefined);
}

// ── Tests ──────────────────────────────────────────────────

describe("processRoiReport", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupHappyPath();
	});

	it("happy path: assembles data, renders HTML+PDF, stores report, returns result", async () => {
		const result = await processRoiReport(makeJob());

		expect(result).toEqual({
			reportId: REPORT_ID,
			projectId: PROJECT_ID,
			generatedAt: expect.any(String),
			fileSizeBytes: expect.any(Number),
		});

		expect(mockGetBaselineSnapshot).toHaveBeenCalledWith(expect.anything(), PROJECT_ID);
		expect(mockGetLatestSnapshot).toHaveBeenCalledWith(expect.anything(), PROJECT_ID);
		expect(mockRenderRoiHtml).toHaveBeenCalled();
		expect(mockRenderPdf).toHaveBeenCalledWith("<html>roi report</html>");
		expect(mockCreateRoiReport).toHaveBeenCalled();
	});

	it("throws when no baseline snapshot", async () => {
		mockGetBaselineSnapshot.mockResolvedValue(null);

		await expect(processRoiReport(makeJob())).rejects.toThrow(
			`No baseline snapshot found for project ${PROJECT_ID}`,
		);
	});

	it("throws when no latest snapshot", async () => {
		mockGetLatestSnapshot.mockResolvedValue(null);

		await expect(processRoiReport(makeJob())).rejects.toThrow(
			`No snapshots found for project ${PROJECT_ID}`,
		);
	});

	it("continues without AI texts when generateRoiReportTexts fails", async () => {
		mockGenerateRoiReportTexts.mockResolvedValue({
			ok: false,
			error: { code: "API_ERROR", message: "timeout", attempts: 1 },
			usage: [],
		});

		const result = await processRoiReport(makeJob());

		expect(result.reportId).toBe(REPORT_ID);
		expect(mockRenderRoiHtml).toHaveBeenCalled();
		// aiTexts should be undefined in the report input
		const renderCall = mockRenderRoiHtml.mock.calls[0][0];
		expect(renderCall.aiTexts).toBeUndefined();
	});

	it("computes correct scoreDelta from baseline vs latest", async () => {
		await processRoiReport(makeJob());

		const createCall = mockCreateRoiReport.mock.calls[0][1];
		expect(createCall.reportData.scoreDelta).toBe(32); // 72 - 40
		expect(createCall.reportData.citationDelta).toBe(6); // 8 - 2
	});

	it("writes both PDF and HTML files to filesystem", async () => {
		await processRoiReport(makeJob());

		expect(mockMkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
		expect(mockWriteFile).toHaveBeenCalledTimes(2);

		const writeCalls = mockWriteFile.mock.calls;
		const paths = writeCalls.map((c: unknown[]) => c[0]);
		expect(paths.some((p: string) => p.endsWith(".pdf"))).toBe(true);
		expect(paths.some((p: string) => p.endsWith(".html"))).toBe(true);
	});

	it("creates report row with correct reportData shape", async () => {
		await processRoiReport(makeJob());

		expect(mockCreateRoiReport).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				projectId: PROJECT_ID,
				baselineSnapshotId: "snap-baseline",
				latestSnapshotId: "snap-latest",
				reportData: expect.objectContaining({
					scoreDelta: 32,
					citationDelta: 6,
					improvements: expect.arrayContaining([
						expect.objectContaining({ checkId: "readability", before: 50, after: 80 }),
					]),
					subScoreDeltas: expect.objectContaining({
						readability: 30,
						interactivity: 25,
						transactional: 25,
					}),
					aiRecommendations: mockAiTexts,
				}),
				format: "pdf",
			}),
		);
	});

	// Email-after-success was wired through the archived auth layer.
	// Re-enabled instance-scoped in #13 (ROI report UI trigger).

	it("passes branding from job data to renderRoiHtml", async () => {
		const branding = {
			agencyName: "Test Agency",
			primaryColor: "#ff0000",
			accentColor: "#00ff00",
			logoUrl: "https://example.com/logo.png",
		};

		await processRoiReport(makeJob({ branding }));

		const renderCall = mockRenderRoiHtml.mock.calls[0][0];
		expect(renderCall.branding).toEqual(branding);
	});
});
