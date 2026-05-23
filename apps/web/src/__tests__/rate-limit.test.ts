import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the rate limiter module.
 *
 * In NODE_ENV=test the rate limiter always allows requests (test bypass).
 * To test the actual limiting logic we re-implement the fixed-window
 * algorithm inline (same approach the module uses for in-memory fallback).
 *
 * Additionally we test the pure helper functions that don't depend on
 * Redis or test-mode: getRateLimitConfig, rateLimitHeaders, createRateLimitResponse.
 */

import type { RateLimitConfig, RateLimitResult } from "../lib/rate-limit.js";

describe("rate-limit", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	// ── test-mode bypass ──────────────────────────────────────

	describe("test-mode bypass", () => {
		it("returns allowed: true with correct remaining and limit", async () => {
			const { checkRateLimit } = await import("../lib/rate-limit.js");
			const result = await checkRateLimit("bypass-key", { maxRequests: 5, windowMs: 60_000 });
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(4);
			expect(result.limit).toBe(5);
			expect(result.resetAt).toBeGreaterThan(Date.now());
		});

		it("returns limit matching config.maxRequests", async () => {
			const { checkRateLimit } = await import("../lib/rate-limit.js");
			const result = await checkRateLimit("bypass-key-2", { maxRequests: 100, windowMs: 60_000 });
			expect(result.limit).toBe(100);
		});
	});

	// ── in-memory fallback (fixed-window algorithm) ──────────

	describe("in-memory fallback", () => {
		interface RateLimitEntry {
			count: number;
			resetAt: number;
		}

		function createLimiter() {
			const store = new Map<string, RateLimitEntry>();

			return function check(key: string, config: RateLimitConfig): RateLimitResult {
				const now = Date.now();
				const entry = store.get(key);

				if (!entry || entry.resetAt < now) {
					store.set(key, { count: 1, resetAt: now + config.windowMs });
					return {
						allowed: true,
						remaining: config.maxRequests - 1,
						limit: config.maxRequests,
						resetAt: now + config.windowMs,
					};
				}

				entry.count += 1;
				if (entry.count > config.maxRequests) {
					return {
						allowed: false,
						remaining: 0,
						limit: config.maxRequests,
						resetAt: entry.resetAt,
					};
				}
				return {
					allowed: true,
					remaining: config.maxRequests - entry.count,
					limit: config.maxRequests,
					resetAt: entry.resetAt,
				};
			};
		}

		it("allows requests within limit", () => {
			const check = createLimiter();
			const cfg: RateLimitConfig = { maxRequests: 3, windowMs: 60_000 };
			const r1 = check("key", cfg);
			const r2 = check("key", cfg);
			const r3 = check("key", cfg);
			expect(r1.allowed).toBe(true);
			expect(r2.allowed).toBe(true);
			expect(r3.allowed).toBe(true);
			expect(r3.remaining).toBe(0);
		});

		it("blocks requests exceeding limit", () => {
			const check = createLimiter();
			const cfg: RateLimitConfig = { maxRequests: 2, windowMs: 60_000 };
			check("key", cfg);
			check("key", cfg);
			const r3 = check("key", cfg);
			expect(r3.allowed).toBe(false);
			expect(r3.remaining).toBe(0);
		});

		it("resets after window expires", () => {
			vi.useFakeTimers();
			const check = createLimiter();
			const cfg: RateLimitConfig = { maxRequests: 1, windowMs: 10_000 };

			check("key", cfg);
			const denied = check("key", cfg);
			expect(denied.allowed).toBe(false);

			vi.advanceTimersByTime(11_000);

			const allowed = check("key", cfg);
			expect(allowed.allowed).toBe(true);
		});

		it("isolates keys (different keys don't interfere)", () => {
			const check = createLimiter();
			const cfg: RateLimitConfig = { maxRequests: 1, windowMs: 60_000 };

			check("a", cfg);
			const deniedA = check("a", cfg);
			expect(deniedA.allowed).toBe(false);

			const allowedB = check("b", cfg);
			expect(allowedB.allowed).toBe(true);
		});
	});

	// ── getRateLimitConfig ───────────────────────────────────

	describe("getRateLimitConfig", () => {
		it("returns correct config for scan + anonymous", async () => {
			const { getRateLimitConfig } = await import("../lib/rate-limit.js");
			const config = getRateLimitConfig("scan", "anonymous");
			expect(config.maxRequests).toBe(5);
			expect(config.windowMs).toBe(60_000);
		});

		it("returns correct config for mutation + pro", async () => {
			const { getRateLimitConfig } = await import("../lib/rate-limit.js");
			const config = getRateLimitConfig("mutation", "pro");
			expect(config.maxRequests).toBe(30);
			expect(config.windowMs).toBe(60_000);
		});

		it("returns correct config for scan + enterprise", async () => {
			const { getRateLimitConfig } = await import("../lib/rate-limit.js");
			const config = getRateLimitConfig("scan", "enterprise");
			expect(config.maxRequests).toBe(300);
		});

		it("defaults to anonymous when no plan specified", async () => {
			const { getRateLimitConfig } = await import("../lib/rate-limit.js");
			const config = getRateLimitConfig("scan");
			expect(config.maxRequests).toBe(5);
		});

		it("limits increase monotonically with plan tier", async () => {
			const { getRateLimitConfig } = await import("../lib/rate-limit.js");
			const tiers = ["free", "starter", "pro", "agency", "enterprise"] as const;
			const limits = tiers.map((t) => getRateLimitConfig("scan", t).maxRequests);
			for (let i = 1; i < limits.length; i++) {
				expect(limits[i]).toBeGreaterThanOrEqual(limits[i - 1]);
			}
		});
	});

	// ── rateLimitHeaders ─────────────────────────────────────

	describe("rateLimitHeaders", () => {
		it("returns correct X-RateLimit-Limit header", async () => {
			const { rateLimitHeaders } = await import("../lib/rate-limit.js");
			const result: RateLimitResult = {
				allowed: true,
				remaining: 8,
				limit: 10,
				resetAt: 1700000000_000,
			};
			const headers = rateLimitHeaders(result);
			expect(headers["X-RateLimit-Limit"]).toBe("10");
		});

		it("returns correct X-RateLimit-Remaining header", async () => {
			const { rateLimitHeaders } = await import("../lib/rate-limit.js");
			const result: RateLimitResult = {
				allowed: true,
				remaining: 8,
				limit: 10,
				resetAt: 1700000000_000,
			};
			const headers = rateLimitHeaders(result);
			expect(headers["X-RateLimit-Remaining"]).toBe("8");
		});

		it("returns X-RateLimit-Reset as epoch seconds (not ms)", async () => {
			const { rateLimitHeaders } = await import("../lib/rate-limit.js");
			const resetMs = 1700000060_000;
			const result: RateLimitResult = { allowed: false, remaining: 0, limit: 10, resetAt: resetMs };
			const headers = rateLimitHeaders(result);
			expect(headers["X-RateLimit-Reset"]).toBe(String(Math.ceil(resetMs / 1000)));
		});
	});

	// ── createRateLimitResponse ──────────────────────────────

	describe("createRateLimitResponse", () => {
		it("returns status 429", async () => {
			const { createRateLimitResponse } = await import("../lib/rate-limit.js");
			const result: RateLimitResult = {
				allowed: false,
				remaining: 0,
				limit: 10,
				resetAt: Date.now() + 30_000,
			};
			const response = createRateLimitResponse(result);
			expect(response.status).toBe(429);
		});

		it("includes Retry-After header", async () => {
			const { createRateLimitResponse } = await import("../lib/rate-limit.js");
			const result: RateLimitResult = {
				allowed: false,
				remaining: 0,
				limit: 10,
				resetAt: Date.now() + 30_000,
			};
			const response = createRateLimitResponse(result);
			const retryAfter = response.headers.get("Retry-After");
			expect(retryAfter).toBeDefined();
			expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
		});

		it("includes German error message", async () => {
			const { createRateLimitResponse } = await import("../lib/rate-limit.js");
			const result: RateLimitResult = {
				allowed: false,
				remaining: 0,
				limit: 10,
				resetAt: Date.now() + 30_000,
			};
			const response = createRateLimitResponse(result);
			const body = await response.json();
			expect(body.error).toContain("Zu viele Anfragen");
		});
	});
});
