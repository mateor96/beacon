import { describe, expect, it } from "vitest";
import { SentimentBatchResponseSchema } from "../schema.js";

describe("SentimentBatchResponseSchema", () => {
	it("accepts valid single result", () => {
		const data = {
			results: [{ mentionIndex: 0, sentiment: "positive", confidence: 0.92 }],
		};
		const result = SentimentBatchResponseSchema.safeParse(data);
		expect(result.success).toBe(true);
	});

	it("accepts valid batch of 10 results", () => {
		const data = {
			results: Array.from({ length: 10 }, (_, i) => ({
				mentionIndex: i,
				sentiment: "neutral",
				confidence: 0.75,
			})),
		};
		const result = SentimentBatchResponseSchema.safeParse(data);
		expect(result.success).toBe(true);
	});

	it("rejects missing mentionIndex", () => {
		const data = {
			results: [{ sentiment: "positive", confidence: 0.9 }],
		};
		const result = SentimentBatchResponseSchema.safeParse(data);
		expect(result.success).toBe(false);
	});

	it("rejects invalid sentiment value", () => {
		const data = {
			results: [{ mentionIndex: 0, sentiment: "very_positive", confidence: 0.9 }],
		};
		const result = SentimentBatchResponseSchema.safeParse(data);
		expect(result.success).toBe(false);
	});

	it("rejects confidence below 0", () => {
		const data = {
			results: [{ mentionIndex: 0, sentiment: "positive", confidence: -0.1 }],
		};
		const result = SentimentBatchResponseSchema.safeParse(data);
		expect(result.success).toBe(false);
	});

	it("rejects confidence above 1", () => {
		const data = {
			results: [{ mentionIndex: 0, sentiment: "positive", confidence: 1.5 }],
		};
		const result = SentimentBatchResponseSchema.safeParse(data);
		expect(result.success).toBe(false);
	});

	it("rejects empty results array", () => {
		const data = { results: [] };
		const result = SentimentBatchResponseSchema.safeParse(data);
		expect(result.success).toBe(false);
	});

	it("rejects bare array (must be wrapped in object)", () => {
		const data = [{ mentionIndex: 0, sentiment: "positive", confidence: 0.9 }];
		const result = SentimentBatchResponseSchema.safeParse(data);
		expect(result.success).toBe(false);
	});

	it("accepts all three sentiment values", () => {
		const data = {
			results: [
				{ mentionIndex: 0, sentiment: "positive", confidence: 0.9 },
				{ mentionIndex: 1, sentiment: "neutral", confidence: 0.7 },
				{ mentionIndex: 2, sentiment: "negative", confidence: 0.85 },
			],
		};
		const result = SentimentBatchResponseSchema.safeParse(data);
		expect(result.success).toBe(true);
	});

	it("rejects non-integer mentionIndex", () => {
		const data = {
			results: [{ mentionIndex: 0.5, sentiment: "positive", confidence: 0.9 }],
		};
		const result = SentimentBatchResponseSchema.safeParse(data);
		expect(result.success).toBe(false);
	});

	it("rejects negative mentionIndex", () => {
		const data = {
			results: [{ mentionIndex: -1, sentiment: "positive", confidence: 0.9 }],
		};
		const result = SentimentBatchResponseSchema.safeParse(data);
		expect(result.success).toBe(false);
	});
});
