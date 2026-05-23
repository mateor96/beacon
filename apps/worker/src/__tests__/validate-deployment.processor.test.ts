import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted to avoid TDZ issues) ─────────────────────

const { mockRecordValidation } = vi.hoisted(() => ({
	mockRecordValidation: vi.fn(),
}));

vi.mock("@beacon/db", () => ({
	db: {},
	fixQueries: {
		recordValidation: (...args: unknown[]) => mockRecordValidation(...args),
	},
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { processValidateDeployment } from "../processors/validate-deployment.processor.js";

// ── Helpers ──────────────────────────────────────────────────

function makeJob(overrides: Partial<Parameters<typeof processValidateDeployment>[0]["data"]> = {}) {
	const data = {
		deploymentAttemptId: "dep-1",
		fixId: "fix-1",
		fixType: "llms_txt",
		expectedContent: "# My llms.txt content",
		siteUrl: "https://example.com",
		...overrides,
	};
	return {
		id: "test-job-1",
		data,
		opts: { attempts: 3 },
		attemptsMade: 0,
		updateProgress: vi.fn(),
		log: vi.fn(),
	} as Parameters<typeof processValidateDeployment>[0];
}

function mockResponse(body: string, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		text: () => Promise.resolve(body),
	} as Response;
}

// ── Tests ────────────────────────────────────────────────────

describe("processValidateDeployment", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRecordValidation.mockResolvedValue({ id: "val-1" });
	});

	it("llms.txt validation passes on exact match", async () => {
		mockFetch.mockResolvedValue(mockResponse("# My llms.txt content"));

		const result = await processValidateDeployment(makeJob());

		expect(result).toEqual({
			deploymentAttemptId: "dep-1",
			status: "pass",
			validationId: "val-1",
		});

		expect(mockRecordValidation).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				deploymentId: "dep-1",
				status: "pass",
				results: expect.objectContaining({
					checksPassed: ["content_present", "content_match"],
					checksFailed: [],
				}),
			}),
		);
	});

	it("llms.txt validation fails on 404", async () => {
		mockFetch.mockResolvedValue(mockResponse("Not Found", 404));

		await expect(processValidateDeployment(makeJob())).rejects.toThrow(
			"Validierung fehlgeschlagen",
		);

		expect(mockRecordValidation).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				status: "fail",
				results: expect.objectContaining({
					checksPassed: [],
					checksFailed: ["content_present", "content_match"],
				}),
			}),
		);
	});

	it("json_ld validation passes when script tag contains matching JSON", async () => {
		const jsonLd = JSON.stringify({
			"@context": "https://schema.org",
			"@type": "Organization",
			name: "Test",
		});
		const html = `<html><head><script type="application/ld+json">${jsonLd}</script></head><body></body></html>`;

		mockFetch.mockResolvedValue(mockResponse(html));

		const result = await processValidateDeployment(
			makeJob({ fixType: "json_ld", expectedContent: jsonLd }),
		);

		expect(result.status).toBe("pass");
		expect(mockRecordValidation).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				status: "pass",
				results: expect.objectContaining({
					checksPassed: ["json_ld_present", "json_ld_match"],
					checksFailed: [],
				}),
			}),
		);
	});

	it("json_ld validation fails when no script tags found", async () => {
		const html = "<html><head></head><body>No JSON-LD here</body></html>";

		mockFetch.mockResolvedValue(mockResponse(html));

		await expect(
			processValidateDeployment(
				makeJob({ fixType: "json_ld", expectedContent: '{"@context":"https://schema.org"}' }),
			),
		).rejects.toThrow("Validierung fehlgeschlagen");

		expect(mockRecordValidation).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				status: "fail",
				results: expect.objectContaining({
					checksPassed: [],
					checksFailed: ["json_ld_present", "json_ld_match"],
				}),
			}),
		);
	});

	it("partial status when content found but differs", async () => {
		mockFetch.mockResolvedValue(mockResponse("# Different content entirely"));

		const result = await processValidateDeployment(makeJob());

		expect(result.status).toBe("partial");
		expect(mockRecordValidation).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				status: "partial",
				results: expect.objectContaining({
					checksPassed: ["content_present"],
					checksFailed: ["content_match"],
				}),
			}),
		);
	});

	it("records validation result via recordValidation", async () => {
		mockFetch.mockResolvedValue(mockResponse("# My llms.txt content"));
		mockRecordValidation.mockResolvedValue({ id: "val-custom-id" });

		const result = await processValidateDeployment(makeJob());

		expect(mockRecordValidation).toHaveBeenCalledTimes(1);
		expect(mockRecordValidation).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				deploymentId: "dep-1",
				scanId: null,
				status: "pass",
				results: expect.objectContaining({
					checksRun: expect.any(Array),
					checksPassed: expect.any(Array),
					checksFailed: expect.any(Array),
					details: expect.any(Object),
				}),
			}),
		);
		expect(result.validationId).toBe("val-custom-id");
	});
});
