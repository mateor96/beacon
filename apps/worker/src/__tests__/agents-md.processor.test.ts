import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetById, mockGenerateAgentsMd, mockFromEnv } = vi.hoisted(() => ({
	mockGetById: vi.fn(),
	mockGenerateAgentsMd: vi.fn(),
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
	generateAgentsMd: (...args: unknown[]) => mockGenerateAgentsMd(...args),
}));

import { processAgentsMd } from "../processors/agents-md.processor";

function makeJob(data: { scanId: string; force?: boolean }) {
	return {
		id: "agents-md-job-1",
		data,
		opts: { attempts: 2 },
		attemptsMade: 0,
		updateProgress: vi.fn(),
	} as Parameters<typeof processAgentsMd>[0];
}

const baseScan = {
	id: "00000000-0000-4000-a000-000000000001",
	userId: "00000000-0000-4000-a000-000000000002",
	url: "https://example.com",
	finalUrl: "https://www.example.com",
	htmlContent: "<html><body><h1>Hello</h1></body></html>",
	checks: [
		{
			id: "agents-md",
			status: "fail",
			score: 0,
			summary: "Missing",
			issues: [{ message: "Keine AGENTS.md gefunden", severity: "important" }],
		},
		{
			id: "robots-txt",
			status: "pass",
			score: 100,
			summary: "OK",
			issues: [],
			details: {
				aiBots: { GPTBot: "allowed", ClaudeBot: "blocked" },
				blanketDisallow: false,
			},
		},
	],
};

describe("processAgentsMd", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("happy path: passes finalUrl + both checks to the generator and returns its result", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateAgentsMd.mockResolvedValue({
			fixId: "fix-1",
			version: 1,
			content: "# Hello",
			contentHash: "hash-1",
			inputHash: "input-hash-1",
			method: "ai-generated",
			costCents: 0.5,
		});

		const result = await processAgentsMd(makeJob({ scanId: baseScan.id }));

		expect(result).toEqual({
			scanId: baseScan.id,
			fixId: "fix-1",
			version: 1,
			method: "ai-generated",
			costCents: 0.5,
		});

		expect(mockGenerateAgentsMd).toHaveBeenCalledTimes(1);
		const call = mockGenerateAgentsMd.mock.calls[0]?.[0] as {
			scanId: string;
			finalUrl: string;
			htmlContent: string;
			agentsMdCheck: { id: string };
			robotsTxtCheck: { id: string };
			force?: boolean;
		};
		expect(call.scanId).toBe(baseScan.id);
		expect(call.finalUrl).toBe(baseScan.finalUrl);
		expect(call.htmlContent).toBe(baseScan.htmlContent);
		expect(call.agentsMdCheck?.id).toBe("agents-md");
		expect(call.robotsTxtCheck?.id).toBe("robots-txt");
		expect(call.force).toBeUndefined();
	});

	it("falls back to scan.url when scan.finalUrl is null", async () => {
		mockGetById.mockResolvedValue({ ...baseScan, finalUrl: null });
		mockGenerateAgentsMd.mockResolvedValue({
			fixId: "fix-2",
			version: 1,
			content: "# Hello",
			contentHash: "h",
			inputHash: "i",
			method: "template-fallback",
			costCents: 0,
		});

		await processAgentsMd(makeJob({ scanId: baseScan.id }));

		const call = mockGenerateAgentsMd.mock.calls[0]?.[0] as { finalUrl: string };
		expect(call.finalUrl).toBe(baseScan.url);
	});

	it("forwards the force flag", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateAgentsMd.mockResolvedValue({
			fixId: "fix-3",
			version: 2,
			content: "# Hello",
			contentHash: "h",
			inputHash: "i",
			method: "ai-generated",
			costCents: 0.5,
		});

		await processAgentsMd(makeJob({ scanId: baseScan.id, force: true }));

		const call = mockGenerateAgentsMd.mock.calls[0]?.[0] as { force?: boolean };
		expect(call.force).toBe(true);
	});

	it("throws when the scan is not found", async () => {
		mockGetById.mockResolvedValue(null);
		await expect(processAgentsMd(makeJob({ scanId: "missing" }))).rejects.toThrow(/not found/);
		expect(mockGenerateAgentsMd).not.toHaveBeenCalled();
	});

	it("throws when the scan has no htmlContent", async () => {
		mockGetById.mockResolvedValue({ ...baseScan, htmlContent: null });
		await expect(processAgentsMd(makeJob({ scanId: baseScan.id }))).rejects.toThrow(
			/no htmlContent/,
		);
		expect(mockGenerateAgentsMd).not.toHaveBeenCalled();
	});

	it("propagates generator errors so BullMQ can retry", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateAgentsMd.mockRejectedValue(
			Object.assign(new Error("rate limited"), { status: 429 }),
		);
		await expect(processAgentsMd(makeJob({ scanId: baseScan.id }))).rejects.toThrow("rate limited");
	});

	it("passes undefined robotsTxtCheck when not in scan checks", async () => {
		mockGetById.mockResolvedValue({
			...baseScan,
			checks: [baseScan.checks[0]], // only agents-md, no robots-txt
		});
		mockGenerateAgentsMd.mockResolvedValue({
			fixId: "fix-4",
			version: 1,
			content: "# Hello",
			contentHash: "h",
			inputHash: "i",
			method: "ai-generated",
			costCents: 0.5,
		});

		await processAgentsMd(makeJob({ scanId: baseScan.id }));

		const call = mockGenerateAgentsMd.mock.calls[0]?.[0] as {
			robotsTxtCheck?: unknown;
		};
		expect(call.robotsTxtCheck).toBeUndefined();
	});
});
