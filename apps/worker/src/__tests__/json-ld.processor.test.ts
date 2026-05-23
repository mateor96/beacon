import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetById, mockGenerateSchemaOrg, mockFromEnv } = vi.hoisted(() => ({
	mockGetById: vi.fn(),
	mockGenerateSchemaOrg: vi.fn(),
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
	generateSchemaOrg: (...args: unknown[]) => mockGenerateSchemaOrg(...args),
}));

import { processJsonLd } from "../processors/json-ld.processor";

function makeJob(data: { scanId: string; force?: boolean }) {
	return {
		id: "json-ld-job-1",
		data,
		opts: { attempts: 2 },
		attemptsMade: 0,
		updateProgress: vi.fn(),
	} as Parameters<typeof processJsonLd>[0];
}

const baseScan = {
	id: "00000000-0000-4000-a000-000000000001",
	userId: "00000000-0000-4000-a000-000000000002",
	url: "https://example.com",
	finalUrl: "https://www.example.com",
	htmlContent: "<html><body><h1>Hello</h1></body></html>",
	checks: [
		{
			id: "schema-org",
			status: "fail",
			score: 0,
			summary: "Kein Schema.org Markup gefunden.",
			issues: [{ message: "Keine JSON-LD Structured Data vorhanden.", severity: "critical" }],
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

describe("processJsonLd", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("happy path: passes finalUrl + schema-org check to the generator and returns its result", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateSchemaOrg.mockResolvedValue({
			fixId: "fix-1",
			version: 1,
			content: '{"@context":"https://schema.org"}',
			contentHash: "hash-1",
			inputHash: "input-hash-1",
			method: "ai-generated",
			costCents: 0.5,
		});

		const result = await processJsonLd(makeJob({ scanId: baseScan.id }));

		expect(result).toEqual({
			scanId: baseScan.id,
			fixId: "fix-1",
			version: 1,
			method: "ai-generated",
			costCents: 0.5,
		});

		expect(mockGenerateSchemaOrg).toHaveBeenCalledTimes(1);
		const call = mockGenerateSchemaOrg.mock.calls[0]?.[0] as {
			scanId: string;
			finalUrl: string;
			htmlContent: string;
			schemaOrgCheck: { id: string };
			force?: boolean;
		};
		expect(call.scanId).toBe(baseScan.id);
		expect(call.finalUrl).toBe(baseScan.finalUrl);
		expect(call.htmlContent).toBe(baseScan.htmlContent);
		expect(call.schemaOrgCheck?.id).toBe("schema-org");
		expect(call.force).toBeUndefined();
	});

	it("falls back to scan.url when scan.finalUrl is null", async () => {
		mockGetById.mockResolvedValue({ ...baseScan, finalUrl: null });
		mockGenerateSchemaOrg.mockResolvedValue({
			fixId: "fix-2",
			version: 1,
			content: "{}",
			contentHash: "h",
			inputHash: "i",
			method: "template-fallback",
			costCents: 0,
		});

		await processJsonLd(makeJob({ scanId: baseScan.id }));

		const call = mockGenerateSchemaOrg.mock.calls[0]?.[0] as { finalUrl: string };
		expect(call.finalUrl).toBe(baseScan.url);
	});

	it("forwards the force flag", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateSchemaOrg.mockResolvedValue({
			fixId: "fix-3",
			version: 2,
			content: "{}",
			contentHash: "h",
			inputHash: "i",
			method: "ai-generated",
			costCents: 0.5,
		});

		await processJsonLd(makeJob({ scanId: baseScan.id, force: true }));

		const call = mockGenerateSchemaOrg.mock.calls[0]?.[0] as { force?: boolean };
		expect(call.force).toBe(true);
	});

	it("throws when the scan is not found", async () => {
		mockGetById.mockResolvedValue(null);
		await expect(processJsonLd(makeJob({ scanId: "missing" }))).rejects.toThrow(/not found/);
		expect(mockGenerateSchemaOrg).not.toHaveBeenCalled();
	});

	it("throws when the scan has no htmlContent", async () => {
		mockGetById.mockResolvedValue({ ...baseScan, htmlContent: null });
		await expect(processJsonLd(makeJob({ scanId: baseScan.id }))).rejects.toThrow(/no htmlContent/);
		expect(mockGenerateSchemaOrg).not.toHaveBeenCalled();
	});

	it("propagates generator errors so BullMQ can retry", async () => {
		mockGetById.mockResolvedValue(baseScan);
		mockGenerateSchemaOrg.mockRejectedValue(
			Object.assign(new Error("rate limited"), { status: 429 }),
		);
		await expect(processJsonLd(makeJob({ scanId: baseScan.id }))).rejects.toThrow("rate limited");
	});
});
