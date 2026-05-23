import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

// ── Mocks ────────────────────────────────────────────────────

const mockCreateRequest = vi.fn();
const mockGetRequestById = vi.fn();
const mockGetResultByRequestId = vi.fn();

vi.mock("@beacon/db", () => ({
	db: {},
	publicAuditQueries: {
		createRequest: (...args: unknown[]) => mockCreateRequest(...args),
		getRequestById: (...args: unknown[]) => mockGetRequestById(...args),
		getResultByRequestId: (...args: unknown[]) => mockGetResultByRequestId(...args),
	},
}));

const mockAssertSafeUrl = vi.fn();
vi.mock("@beacon/scanner", () => ({
	assertSafeUrl: (...args: unknown[]) => mockAssertSafeUrl(...args),
}));

vi.mock("@beacon/shared", () => {
	const { z } = require("zod");
	const UrlSchema = z
		.string()
		.url("Bitte geben Sie eine gueltige URL ein.")
		.regex(/^https?:\/\//, "URL muss mit http:// oder https:// beginnen.");
	return {
		ScanRequestSchema: z.object({ url: UrlSchema }),
		UuidSchema: z.string().uuid({ message: "Ungültige ID" }),
	};
});

const mockAddJob = vi.fn().mockResolvedValue({ id: "job-1" });
vi.mock("@beacon/queue", () => ({
	addJob: (...args: unknown[]) => mockAddJob(...args),
}));

const mockCheckRateLimit = vi.fn();
const mockCreateRateLimitResponse = vi.fn();
const mockGetRateLimitConfig = vi.fn().mockReturnValue({ maxRequests: 5, windowMs: 60_000 });
const mockRateLimitHeaders = vi.fn().mockReturnValue({});
vi.mock("@/lib/rate-limit", () => ({
	checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
	createRateLimitResponse: (...args: unknown[]) => mockCreateRateLimitResponse(...args),
	getRateLimitConfig: (...args: unknown[]) => mockGetRateLimitConfig(...args),
	rateLimitHeaders: (...args: unknown[]) => mockRateLimitHeaders(...args),
}));

vi.mock("@/lib/hash-ip", () => ({
	hashIp: () => "hashed-ip",
}));

vi.mock("@/lib/request-guards", () => ({
	assertJsonContentType: () => null,
}));

// ── Helpers ──────────────────────────────────────────────────

function makePostRequest(body?: unknown) {
	return new Request("http://localhost:3000/api/public/audit", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-forwarded-for": "1.2.3.4",
		},
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
}

function makeInvalidJsonPostRequest() {
	return new Request("http://localhost:3000/api/public/audit", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-forwarded-for": "1.2.3.4",
		},
		body: "not-json{",
	});
}

function makeGetRequest(jobId: string) {
	return new Request(`http://localhost:3000/api/public/audit/${jobId}`, {
		method: "GET",
		headers: {
			"x-forwarded-for": "1.2.3.4",
		},
	});
}

async function callPostHandler(request: Request) {
	const { POST } = await import("@/app/api/public/audit/route");
	return POST(request);
}

async function callGetHandler(request: Request, jobId: string) {
	const { GET } = await import("@/app/api/public/audit/[jobId]/route");
	const { NextRequest } = await import("next/server");
	return GET(new NextRequest(request), { params: Promise.resolve({ jobId }) });
}

// ── Tests ────────────────────────────────────────────────────

describe("POST /api/public/audit", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCheckRateLimit.mockResolvedValue({
			allowed: true,
			remaining: 4,
			resetAt: Date.now() + 60_000,
			limit: 5,
		});
		mockCreateRateLimitResponse.mockImplementation((result: { resetAt: number }) => {
			const { NextResponse } = require("next/server");
			return NextResponse.json(
				{ error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." },
				{
					status: 429,
					headers: {
						"Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
					},
				},
			);
		});
		mockRateLimitHeaders.mockReturnValue({});
		mockAssertSafeUrl.mockImplementation(() => {});
		mockCreateRequest.mockResolvedValue({
			id: VALID_UUID,
			url: "https://example.com",
			status: "pending",
		});
		mockAddJob.mockResolvedValue({ id: "job-1" });
	});

	it("returns 202 with jobId and status pending for valid URL", async () => {
		const response = await callPostHandler(makePostRequest({ url: "https://example.com" }));
		expect(response.status).toBe(202);
		const body = await response.json();
		expect(body.jobId).toBe(VALID_UUID);
		expect(body.status).toBe("pending");
	});

	it("creates public_audit_requests row with correct ipHash and url", async () => {
		await callPostHandler(makePostRequest({ url: "https://example.com" }));
		expect(mockCreateRequest).toHaveBeenCalledOnce();
		const callArgs = mockCreateRequest.mock.calls[0];
		// First arg is db, second is data object
		const data = callArgs[1] ?? callArgs[0];
		expect(data).toMatchObject({
			url: "https://example.com",
			ipHash: "hashed-ip",
		});
	});

	it("enqueues job to public-audit queue with requestId and url", async () => {
		await callPostHandler(makePostRequest({ url: "https://example.com" }));
		expect(mockAddJob).toHaveBeenCalledOnce();
		const callArgs = mockAddJob.mock.calls[0];
		expect(callArgs[0]).toBe("public-audit");
		expect(callArgs[1]).toMatchObject({
			requestId: VALID_UUID,
			url: "https://example.com",
		});
	});

	it("returns 400 for missing URL in body", async () => {
		const response = await callPostHandler(makePostRequest({}));
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBeDefined();
	});

	it("returns 400 for invalid URL format", async () => {
		const response = await callPostHandler(makePostRequest({ url: "not-a-url" }));
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBeDefined();
	});

	it("returns 400 when assertSafeUrl throws (SSRF)", async () => {
		mockAssertSafeUrl.mockImplementation(() => {
			throw new Error("SSRF blocked");
		});
		const response = await callPostHandler(makePostRequest({ url: "http://localhost:8080" }));
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBeDefined();
	});

	it("returns 429 when rate limited", async () => {
		mockCheckRateLimit.mockResolvedValue({
			allowed: false,
			remaining: 0,
			resetAt: Date.now() + 60_000,
			limit: 5,
		});
		const response = await callPostHandler(makePostRequest({ url: "https://example.com" }));
		expect(response.status).toBe(429);
		const body = await response.json();
		expect(body.error).toBeDefined();
	});

	it("returns 400 for unparseable JSON body", async () => {
		const response = await callPostHandler(makeInvalidJsonPostRequest());
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBeDefined();
	});

	it("returns 500 when DB insert throws", async () => {
		mockCreateRequest.mockRejectedValue(new Error("DB connection failed"));
		const response = await callPostHandler(makePostRequest({ url: "https://example.com" }));
		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body.error).toBeDefined();
	});
});

describe("GET /api/public/audit/[jobId]", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCheckRateLimit.mockResolvedValue({
			allowed: true,
			remaining: 59,
			resetAt: Date.now() + 60_000,
			limit: 60,
		});
	});

	it("returns 200 with status pending for pending request", async () => {
		mockGetRequestById.mockResolvedValue({
			id: VALID_UUID,
			url: "https://example.com",
			status: "pending",
			createdAt: new Date(),
		});
		const response = await callGetHandler(makeGetRequest(VALID_UUID), VALID_UUID);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.status).toBe("pending");
	});

	it("returns 200 with status completed and result for completed request", async () => {
		mockGetRequestById.mockResolvedValue({
			id: VALID_UUID,
			url: "https://example.com",
			status: "completed",
			createdAt: new Date(),
		});
		mockGetResultByRequestId.mockResolvedValue({
			id: "result-1",
			requestId: VALID_UUID,
			overallScore: 85,
			modelScores: { seo: 90 },
			summary: { passed: 8, failed: 2 },
			rawData: { internal: "should-not-appear" },
		});
		const response = await callGetHandler(makeGetRequest(VALID_UUID), VALID_UUID);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.status).toBe("completed");
		expect(body.result).toBeDefined();
		expect(body.result.overallScore).toBe(85);
	});

	it("returns 200 with status failed for failed request", async () => {
		mockGetRequestById.mockResolvedValue({
			id: VALID_UUID,
			url: "https://example.com",
			status: "failed",
			createdAt: new Date(),
		});
		const response = await callGetHandler(makeGetRequest(VALID_UUID), VALID_UUID);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.status).toBe("failed");
	});

	it("returns 400 for invalid UUID", async () => {
		const response = await callGetHandler(makeGetRequest("not-a-uuid"), "not-a-uuid");
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBeDefined();
	});

	it("returns 404 for non-existent request", async () => {
		mockGetRequestById.mockResolvedValue(undefined);
		const response = await callGetHandler(makeGetRequest(VALID_UUID), VALID_UUID);
		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error).toBeDefined();
	});

	it("does NOT include rawData in completed response", async () => {
		mockGetRequestById.mockResolvedValue({
			id: VALID_UUID,
			url: "https://example.com",
			status: "completed",
			createdAt: new Date(),
		});
		mockGetResultByRequestId.mockResolvedValue({
			id: "result-1",
			requestId: VALID_UUID,
			overallScore: 85,
			modelScores: { seo: 90 },
			summary: { passed: 8, failed: 2 },
			rawData: { internal: "secret-data" },
		});
		const response = await callGetHandler(makeGetRequest(VALID_UUID), VALID_UUID);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.result?.rawData).toBeUndefined();
	});
});
