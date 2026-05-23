import { describe, expect, it, vi } from "vitest";
import { classifySentimentBatch } from "../classifier.js";
import {
	MENTION_NEGATIVE,
	MENTION_NEUTRAL,
	MENTION_POSITIVE,
	MENTION_SHORT_CONTEXT,
	MOCK_USAGE,
	makeMentions,
	makeValidLlmResponse,
} from "./fixtures.js";

function createMockClient(responseText: string) {
	return {
		complete: vi.fn().mockResolvedValue({
			text: responseText,
			usage: MOCK_USAGE,
		}),
	} as never;
}

function createFailingClient() {
	return {
		complete: vi.fn().mockRejectedValue(new Error("API unavailable")),
	} as never;
}

describe("classifySentimentBatch", () => {
	it("returns empty results for empty input", async () => {
		const result = await classifySentimentBatch([], null);
		expect(result.classifications).toEqual([]);
		expect(result.fallbackUsed).toBe(false);
		expect(result.costCents).toBe(0);
	});

	it("falls back to keyword sentiment when client is null", async () => {
		const mentions = [MENTION_POSITIVE, MENTION_NEGATIVE, MENTION_NEUTRAL];
		const result = await classifySentimentBatch(mentions, null);

		expect(result.classifications.length).toBe(3);
		expect(result.fallbackUsed).toBe(true);
		expect(result.classifications[0].sentiment).toBe("positive");
		expect(result.classifications[0].source).toBe("keyword");
		expect(result.classifications[0].confidence).toBe(0.5);
		expect(result.costCents).toBe(0);
	});

	it("classifies mentions via LLM and returns results", async () => {
		const mentions = [MENTION_POSITIVE, MENTION_NEGATIVE];
		const response = JSON.stringify({
			results: [
				{ mentionIndex: 0, sentiment: "positive", confidence: 0.95 },
				{ mentionIndex: 1, sentiment: "negative", confidence: 0.88 },
			],
		});
		const client = createMockClient(response);

		const result = await classifySentimentBatch(mentions, client);

		expect(result.classifications.length).toBe(2);
		expect(result.classifications[0].mentionId).toBe("m-pos-1");
		expect(result.classifications[0].sentiment).toBe("positive");
		expect(result.classifications[0].confidence).toBe(0.95);
		expect(result.classifications[0].source).toBe("llm");
		expect(result.classifications[1].sentiment).toBe("negative");
		expect(result.fallbackUsed).toBe(false);
	});

	it("fills missing indices with keyword fallback", async () => {
		const mentions = [MENTION_POSITIVE, MENTION_NEGATIVE, MENTION_NEUTRAL];
		const response = JSON.stringify({
			results: [
				{ mentionIndex: 0, sentiment: "positive", confidence: 0.9 },
				// Index 1 and 2 missing
			],
		});
		const client = createMockClient(response);

		const result = await classifySentimentBatch(mentions, client);

		expect(result.classifications.length).toBe(3);
		expect(result.classifications[0].source).toBe("llm");
		expect(result.classifications[1].source).toBe("keyword");
		expect(result.classifications[1].confidence).toBe(0.3);
		expect(result.classifications[2].source).toBe("keyword");
		expect(result.fallbackUsed).toBe(true);
	});

	it("falls back to keyword on LLM API error", async () => {
		const mentions = [MENTION_POSITIVE];
		const client = createFailingClient();

		const result = await classifySentimentBatch(mentions, client);

		expect(result.classifications.length).toBe(1);
		expect(result.classifications[0].source).toBe("keyword");
		expect(result.classifications[0].sentiment).toBe("positive");
		expect(result.fallbackUsed).toBe(true);
	});

	it("chunks large batches into groups of 10", async () => {
		const mentions = makeMentions(25);
		const client = {
			complete: vi
				.fn()
				.mockResolvedValueOnce({ text: makeValidLlmResponse(10), usage: MOCK_USAGE })
				.mockResolvedValueOnce({ text: makeValidLlmResponse(10), usage: MOCK_USAGE })
				.mockResolvedValueOnce({ text: makeValidLlmResponse(5), usage: MOCK_USAGE }),
		} as never;

		const result = await classifySentimentBatch(mentions, client);

		expect(result.classifications.length).toBe(25);
		expect(
			(client as unknown as { complete: ReturnType<typeof vi.fn> }).complete,
		).toHaveBeenCalledTimes(3);
	});

	it("handles single mention batch", async () => {
		const response = JSON.stringify({
			results: [{ mentionIndex: 0, sentiment: "neutral", confidence: 0.75 }],
		});
		const client = createMockClient(response);

		const result = await classifySentimentBatch([MENTION_SHORT_CONTEXT], client);

		expect(result.classifications.length).toBe(1);
		expect(result.classifications[0].sentiment).toBe("neutral");
	});

	it("preserves mention ID association across chunks", async () => {
		const mentions = makeMentions(12);
		const client = {
			complete: vi
				.fn()
				.mockResolvedValueOnce({ text: makeValidLlmResponse(10), usage: MOCK_USAGE })
				.mockResolvedValueOnce({ text: makeValidLlmResponse(2), usage: MOCK_USAGE }),
		} as never;

		const result = await classifySentimentBatch(mentions, client);

		expect(result.classifications[0].mentionId).toBe("m-batch-0");
		expect(result.classifications[11].mentionId).toBe("m-batch-11");
	});

	it("handles partial chunk failure gracefully", async () => {
		const mentions = makeMentions(15);
		const client = {
			complete: vi
				.fn()
				.mockResolvedValueOnce({ text: makeValidLlmResponse(10), usage: MOCK_USAGE })
				.mockRejectedValueOnce(new Error("Rate limit")),
		} as never;

		const result = await classifySentimentBatch(mentions, client);

		expect(result.classifications.length).toBe(15);
		// First 10 should be LLM, last 5 should be keyword fallback
		const llmResults = result.classifications.filter((c) => c.source === "llm");
		const keywordResults = result.classifications.filter((c) => c.source === "keyword");
		expect(llmResults.length).toBe(10);
		expect(keywordResults.length).toBe(5);
		expect(result.fallbackUsed).toBe(true);
	});

	it("uses custom batch size when provided", async () => {
		const mentions = makeMentions(8);
		const client = {
			complete: vi
				.fn()
				.mockResolvedValueOnce({ text: makeValidLlmResponse(3), usage: MOCK_USAGE })
				.mockResolvedValueOnce({ text: makeValidLlmResponse(3), usage: MOCK_USAGE })
				.mockResolvedValueOnce({ text: makeValidLlmResponse(2), usage: MOCK_USAGE }),
		} as never;

		const result = await classifySentimentBatch(mentions, client, { batchSize: 3 });

		expect(
			(client as unknown as { complete: ReturnType<typeof vi.fn> }).complete,
		).toHaveBeenCalledTimes(3);
		expect(result.classifications.length).toBe(8);
	});
});
