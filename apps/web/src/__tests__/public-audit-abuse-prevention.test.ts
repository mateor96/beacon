import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

// ── Mocks ────────────────────────────────────────────────────

const mockCreateRequest = vi.fn();

vi.mock("@beacon/db", () => ({
	db: {},
	publicAuditQueries: {
		createRequest: (...args: unknown[]) => mockCreateRequest(...args),
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

const mockVerifyCaptcha = vi.fn();
vi.mock("@/lib/captcha", () => ({
	verifyCaptcha: (...args: unknown[]) => mockVerifyCaptcha(...args),
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

async function callPostHandler(request: Request) {
	const { POST } = await import("@/app/api/public/audit/route");
	return POST(request);
}

/** Default mock setup: per-minute allowed, daily allowed with remaining=2 */
function setupDefaultMocks() {
	// First call = per-minute rate limit, second call = daily rate limit
	mockCheckRateLimit
		.mockResolvedValueOnce({
			allowed: true,
			remaining: 4,
			resetAt: Date.now() + 60_000,
			limit: 5,
		})
		.mockResolvedValueOnce({
			allowed: true,
			remaining: 2,
			resetAt: Date.now() + 86_400_000,
			limit: 3,
		});
	mockCreateRateLimitResponse.mockImplementation(
		(result: { resetAt: number }, message?: string) => {
			const { NextResponse } = require("next/server");
			return NextResponse.json(
				{ error: message ?? "Zu viele Anfragen. Bitte versuchen Sie es später erneut." },
				{
					status: 429,
					headers: {
						"Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
					},
				},
			);
		},
	);
	mockRateLimitHeaders.mockReturnValue({});
	mockAssertSafeUrl.mockImplementation(() => {});
	mockCreateRequest.mockResolvedValue({
		id: VALID_UUID,
		url: "https://example.com",
		status: "pending",
	});
	mockAddJob.mockResolvedValue({ id: "job-1" });
	mockVerifyCaptcha.mockResolvedValue(true);
}

// ── Tests ────────────────────────────────────────────────────

describe("POST /api/public/audit – abuse prevention", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupDefaultMocks();
	});

	// ── 24h daily cap ────────────────────────────────────────

	describe("24h daily cap", () => {
		it("returns 429 when daily checkRateLimit returns allowed: false", async () => {
			mockCheckRateLimit
				.mockReset()
				.mockResolvedValueOnce({
					allowed: true,
					remaining: 4,
					resetAt: Date.now() + 60_000,
					limit: 5,
				})
				.mockResolvedValueOnce({
					allowed: false,
					remaining: 0,
					resetAt: Date.now() + 86_400_000,
					limit: 3,
				});

			const response = await callPostHandler(makePostRequest({ url: "https://example.com" }));
			expect(response.status).toBe(429);
		});

		it("returns 202 when daily limit is not exceeded", async () => {
			const response = await callPostHandler(makePostRequest({ url: "https://example.com" }));
			expect(response.status).toBe(202);
		});

		it("429 message contains 'Tageslimit'", async () => {
			mockCheckRateLimit
				.mockReset()
				.mockResolvedValueOnce({
					allowed: true,
					remaining: 4,
					resetAt: Date.now() + 60_000,
					limit: 5,
				})
				.mockResolvedValueOnce({
					allowed: false,
					remaining: 0,
					resetAt: Date.now() + 86_400_000,
					limit: 3,
				});

			const response = await callPostHandler(makePostRequest({ url: "https://example.com" }));
			const body = await response.json();
			expect(body.error).toContain("Tageslimit");
		});
	});

	// ── Honeypot ─────────────────────────────────────────────

	describe("honeypot", () => {
		it("returns 202 with fake jobId when website_url_confirm is filled (DB NOT called)", async () => {
			const response = await callPostHandler(
				makePostRequest({ url: "https://example.com", website_url_confirm: "http://spam.com" }),
			);
			expect(response.status).toBe(202);
			const body = await response.json();
			expect(body.jobId).toBeDefined();
			expect(body.status).toBe("pending");
			// DB should NOT be called – bot was silently trapped
			expect(mockCreateRequest).not.toHaveBeenCalled();
		});

		it("proceeds normally when honeypot field is absent", async () => {
			const response = await callPostHandler(makePostRequest({ url: "https://example.com" }));
			expect(response.status).toBe(202);
			expect(mockCreateRequest).toHaveBeenCalledOnce();
		});
	});

	// ── Fingerprint ──────────────────────────────────────────

	describe("fingerprint", () => {
		it("stores fingerprint in DB row when provided", async () => {
			const fp = "abcdef1234567890";
			// Need a third mock value for the fingerprint rate limit check
			mockCheckRateLimit
				.mockReset()
				.mockResolvedValueOnce({
					allowed: true,
					remaining: 4,
					resetAt: Date.now() + 60_000,
					limit: 5,
				})
				.mockResolvedValueOnce({
					allowed: true,
					remaining: 2,
					resetAt: Date.now() + 86_400_000,
					limit: 3,
				})
				.mockResolvedValueOnce({
					allowed: true,
					remaining: 2,
					resetAt: Date.now() + 86_400_000,
					limit: 3,
				});

			const response = await callPostHandler(
				makePostRequest({ url: "https://example.com", fingerprint: fp }),
			);
			expect(response.status).toBe(202);
			expect(mockCreateRequest).toHaveBeenCalledOnce();
			const callArgs = mockCreateRequest.mock.calls[0];
			const data = callArgs[1] ?? callArgs[0];
			expect(data.fingerprint).toBe(fp);
		});

		it("returns 429 when fingerprint rate limit exceeded", async () => {
			const fp = "abcdef1234567890";
			mockCheckRateLimit
				.mockReset()
				// per-minute: ok
				.mockResolvedValueOnce({
					allowed: true,
					remaining: 4,
					resetAt: Date.now() + 60_000,
					limit: 5,
				})
				// daily: ok
				.mockResolvedValueOnce({
					allowed: true,
					remaining: 2,
					resetAt: Date.now() + 86_400_000,
					limit: 3,
				})
				// fingerprint: blocked
				.mockResolvedValueOnce({
					allowed: false,
					remaining: 0,
					resetAt: Date.now() + 86_400_000,
					limit: 3,
				});

			const response = await callPostHandler(
				makePostRequest({ url: "https://example.com", fingerprint: fp }),
			);
			expect(response.status).toBe(429);
		});
	});

	// ── CAPTCHA ──────────────────────────────────────────────

	describe("CAPTCHA", () => {
		it("skips CAPTCHA when token absent (no error)", async () => {
			const response = await callPostHandler(makePostRequest({ url: "https://example.com" }));
			expect(response.status).toBe(202);
			expect(mockVerifyCaptcha).not.toHaveBeenCalled();
		});

		it("returns 400 when CAPTCHA verification fails", async () => {
			mockVerifyCaptcha.mockResolvedValue(false);
			// Daily remaining < 2 to trigger CAPTCHA path
			mockCheckRateLimit
				.mockReset()
				.mockResolvedValueOnce({
					allowed: true,
					remaining: 4,
					resetAt: Date.now() + 60_000,
					limit: 5,
				})
				.mockResolvedValueOnce({
					allowed: true,
					remaining: 0,
					resetAt: Date.now() + 86_400_000,
					limit: 3,
				});

			const response = await callPostHandler(
				makePostRequest({ url: "https://example.com", captchaToken: "bad-token" }),
			);
			expect(response.status).toBe(400);
			const body = await response.json();
			expect(body.error).toContain("CAPTCHA");
		});

		it("accepts valid CAPTCHA token", async () => {
			mockVerifyCaptcha.mockResolvedValue(true);
			// Daily remaining < 2 to trigger CAPTCHA path
			mockCheckRateLimit
				.mockReset()
				.mockResolvedValueOnce({
					allowed: true,
					remaining: 4,
					resetAt: Date.now() + 60_000,
					limit: 5,
				})
				.mockResolvedValueOnce({
					allowed: true,
					remaining: 1,
					resetAt: Date.now() + 86_400_000,
					limit: 3,
				});

			const response = await callPostHandler(
				makePostRequest({ url: "https://example.com", captchaToken: "valid-token" }),
			);
			expect(response.status).toBe(202);
			expect(mockVerifyCaptcha).toHaveBeenCalledWith("valid-token", "1.2.3.4");
		});
	});
});
