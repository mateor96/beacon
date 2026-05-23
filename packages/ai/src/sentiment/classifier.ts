import type { ClaudeClient } from "../client.js";
import { calculateCostCents } from "../providers/pricing.js";
import { withValidatedRetry } from "../retry.js";
import type { AiResult } from "../types.js";
import { SENTIMENT_SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";
import { SentimentBatchResponseSchema, type ValidatedSentimentBatchResponse } from "./schema.js";
import type { SentimentBatchResult, SentimentInput } from "./types.js";

function chunkArray<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size));
	}
	return chunks;
}

async function classifySingleBatch(
	batch: SentimentInput[],
	client: ClaudeClient,
): Promise<AiResult<ValidatedSentimentBatchResponse>> {
	const userMessage = buildUserMessage(batch);

	return withValidatedRetry({
		call: (prompt) =>
			client.complete({
				systemPrompt: SENTIMENT_SYSTEM_PROMPT,
				userMessage: prompt,
				operation: "sentiment-analysis",
				maxTokens: 512,
			}),
		prompt: userMessage,
		schema: SentimentBatchResponseSchema,
		config: { maxRetries: 1, feedbackErrors: true },
	});
}

/**
 * Classifies sentiment for a batch of mentions using Claude Haiku.
 * Falls back to keyword-based sentiment when the LLM is unavailable.
 */
export async function classifySentimentBatch(
	mentions: SentimentInput[],
	client: ClaudeClient | null,
	options?: { batchSize?: number },
): Promise<SentimentBatchResult> {
	const batchSize = options?.batchSize ?? 10;

	if (mentions.length === 0) {
		return { classifications: [], fallbackUsed: false, costCents: 0 };
	}

	// No client available — use keyword fallback for all
	if (!client) {
		return {
			classifications: mentions.map((m) => ({
				mentionId: m.mentionId,
				sentiment: m.currentSentiment,
				confidence: 0.5,
				source: "keyword" as const,
			})),
			fallbackUsed: true,
			costCents: 0,
		};
	}

	const chunks = chunkArray(mentions, batchSize);
	const allClassifications: SentimentBatchResult["classifications"] = [];
	let fallbackUsed = false;
	let totalCostCents = 0;

	for (const chunk of chunks) {
		const result = await classifySingleBatch(chunk, client);

		if (result.ok) {
			// Map LLM results back to mention IDs
			const resultMap = new Map(result.data.results.map((r) => [r.mentionIndex, r]));

			for (let i = 0; i < chunk.length; i++) {
				const llmResult = resultMap.get(i);
				if (llmResult) {
					allClassifications.push({
						mentionId: chunk[i].mentionId,
						sentiment: llmResult.sentiment,
						confidence: llmResult.confidence,
						source: "llm",
					});
				} else {
					// LLM omitted this mention — fallback
					allClassifications.push({
						mentionId: chunk[i].mentionId,
						sentiment: chunk[i].currentSentiment,
						confidence: 0.3,
						source: "keyword",
					});
					fallbackUsed = true;
				}
			}

			// Track cost from usage
			for (const u of result.usage) {
				totalCostCents += calculateCostCents(u.model, u.inputTokens, u.outputTokens);
			}
		} else {
			// Entire batch failed — fallback to keyword for all in chunk
			fallbackUsed = true;
			for (const m of chunk) {
				allClassifications.push({
					mentionId: m.mentionId,
					sentiment: m.currentSentiment,
					confidence: 0.5,
					source: "keyword",
				});
			}
		}
	}

	return { classifications: allClassifications, fallbackUsed, costCents: totalCostCents };
}
