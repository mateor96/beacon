import type { TokenUsage } from "@beacon/shared";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { stripJsonFences, withValidatedRetry } from "../retry.js";

const TestSchema = z.object({ value: z.string(), count: z.number() });

function mockUsage(): TokenUsage {
	return {
		inputTokens: 100,
		outputTokens: 50,
		model: "claude-haiku-4-5-20251001",
		operation: "semantic-analysis",
		durationMs: 500,
	};
}

// ── stripJsonFences ─────────────────────────────────────────

describe("stripJsonFences", () => {
	it("strips ```json prefix and ``` suffix", () => {
		const input = '```json\n{"value":"hello","count":1}\n```';
		expect(stripJsonFences(input)).toBe('{"value":"hello","count":1}');
	});

	it("handles plain JSON without fences", () => {
		const input = '{"value":"hello","count":1}';
		expect(stripJsonFences(input)).toBe('{"value":"hello","count":1}');
	});

	it("handles whitespace around fences", () => {
		const input = '```json  \n  {"value":"hello","count":1}  \n```  ';
		expect(stripJsonFences(input)).toBe('{"value":"hello","count":1}');
	});
});

// ── withValidatedRetry — success ────────────────────────────

describe("withValidatedRetry — success", () => {
	it("returns ok:true on first attempt with valid JSON", async () => {
		const call = vi.fn().mockResolvedValue({
			text: '{"value":"hello","count":42}',
			usage: mockUsage(),
		});

		const result = await withValidatedRetry({
			call,
			prompt: "test prompt",
			schema: TestSchema,
		});

		expect(result.ok).toBe(true);
		expect(call).toHaveBeenCalledTimes(1);
	});

	it("returns data matching the schema", async () => {
		const call = vi.fn().mockResolvedValue({
			text: '{"value":"world","count":7}',
			usage: mockUsage(),
		});

		const result = await withValidatedRetry({
			call,
			prompt: "test prompt",
			schema: TestSchema,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data).toEqual({ value: "world", count: 7 });
		}
	});
});

// ── withValidatedRetry — retry on validation error ──────────

describe("withValidatedRetry — retry on validation error", () => {
	it("retries on invalid data, succeeds on second attempt", async () => {
		const call = vi
			.fn()
			.mockResolvedValueOnce({
				text: '{"value":"hello"}', // missing count
				usage: mockUsage(),
			})
			.mockResolvedValueOnce({
				text: '{"value":"hello","count":1}',
				usage: mockUsage(),
			});

		const result = await withValidatedRetry({
			call,
			prompt: "test prompt",
			schema: TestSchema,
		});

		expect(result.ok).toBe(true);
		expect(call).toHaveBeenCalledTimes(2);
	});

	it("usage array contains entries for all attempts", async () => {
		const call = vi
			.fn()
			.mockResolvedValueOnce({
				text: '{"value":"hello"}', // invalid
				usage: { ...mockUsage(), inputTokens: 100 },
			})
			.mockResolvedValueOnce({
				text: '{"value":"hello","count":1}',
				usage: { ...mockUsage(), inputTokens: 200 },
			});

		const result = await withValidatedRetry({
			call,
			prompt: "test prompt",
			schema: TestSchema,
		});

		expect(result.usage).toHaveLength(2);
		expect(result.usage[0].inputTokens).toBe(100);
		expect(result.usage[1].inputTokens).toBe(200);
	});
});

// ── withValidatedRetry — retry on JSON parse error ──────────

describe("withValidatedRetry — retry on JSON parse error", () => {
	it("retries when first call returns non-JSON, succeeds on second", async () => {
		const call = vi
			.fn()
			.mockResolvedValueOnce({
				text: "This is not JSON at all",
				usage: mockUsage(),
			})
			.mockResolvedValueOnce({
				text: '{"value":"ok","count":5}',
				usage: mockUsage(),
			});

		const result = await withValidatedRetry({
			call,
			prompt: "test prompt",
			schema: TestSchema,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data).toEqual({ value: "ok", count: 5 });
		}
		expect(call).toHaveBeenCalledTimes(2);
	});
});

// ── withValidatedRetry — max retries exhausted ──────────────

describe("withValidatedRetry — max retries exhausted", () => {
	it("returns ok:false after maxRetries+1 attempts", async () => {
		const call = vi.fn().mockResolvedValue({
			text: '{"value":"hello"}', // always invalid — missing count
			usage: mockUsage(),
		});

		const result = await withValidatedRetry({
			call,
			prompt: "test prompt",
			schema: TestSchema,
			config: { maxRetries: 2 },
		});

		expect(result.ok).toBe(false);
		expect(call).toHaveBeenCalledTimes(3); // initial + 2 retries
	});

	it("error.code is VALIDATION_FAILED and error.attempts matches", async () => {
		const call = vi.fn().mockResolvedValue({
			text: '{"value":"hello"}', // always invalid
			usage: mockUsage(),
		});

		const result = await withValidatedRetry({
			call,
			prompt: "test prompt",
			schema: TestSchema,
			config: { maxRetries: 1 },
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("VALIDATION_FAILED");
			expect(result.error.attempts).toBe(2); // initial + 1 retry
		}
	});
});

// ── withValidatedRetry — API error ──────────────────────────

describe("withValidatedRetry — API error", () => {
	it("returns ok:false with error.code API_ERROR when call throws", async () => {
		const call = vi.fn().mockRejectedValue(new Error("Connection timeout"));

		const result = await withValidatedRetry({
			call,
			prompt: "test prompt",
			schema: TestSchema,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("API_ERROR");
			expect(result.error.message).toBe("Connection timeout");
			expect(result.error.attempts).toBe(1);
		}
	});
});

// ── withValidatedRetry — config override ────────────────────

describe("withValidatedRetry — config override", () => {
	it("fails immediately on first invalid response when maxRetries is 0", async () => {
		const call = vi.fn().mockResolvedValue({
			text: '{"value":"hello"}', // invalid — missing count
			usage: mockUsage(),
		});

		const result = await withValidatedRetry({
			call,
			prompt: "test prompt",
			schema: TestSchema,
			config: { maxRetries: 0 },
		});

		expect(result.ok).toBe(false);
		expect(call).toHaveBeenCalledTimes(1);
		if (!result.ok) {
			expect(result.error.attempts).toBe(1);
		}
	});
});
