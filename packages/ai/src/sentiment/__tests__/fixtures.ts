import type { SentimentInput } from "../types.js";

export const MENTION_POSITIVE: SentimentInput = {
	mentionId: "m-pos-1",
	brandName: "Acme Corp",
	contextText:
		"I would highly recommend Acme Corp for cloud hosting. Their excellent and reliable service is outstanding among competitors.",
	mentionType: "recommendation",
	aiEngine: "chatgpt",
	currentSentiment: "positive",
};

export const MENTION_NEGATIVE: SentimentInput = {
	mentionId: "m-neg-1",
	brandName: "Acme Corp",
	contextText:
		"Acme Corp has poor and unreliable customer support. Avoid at all costs, there are much better alternatives available.",
	mentionType: "comparison",
	aiEngine: "perplexity",
	currentSentiment: "negative",
};

export const MENTION_NEUTRAL: SentimentInput = {
	mentionId: "m-neu-1",
	brandName: "Acme Corp",
	contextText:
		"Acme Corp is headquartered in Berlin, Germany. The company was founded in 2020 and employs around 50 people.",
	mentionType: "passing",
	aiEngine: "gemini",
	currentSentiment: "neutral",
};

export const MENTION_GERMAN_POSITIVE: SentimentInput = {
	mentionId: "m-de-pos-1",
	brandName: "Deutsche Telekom",
	contextText:
		"Ich empfehle Deutsche Telekom für hervorragende und zuverlässige Mobilfunkdienste in Deutschland.",
	mentionType: "recommendation",
	aiEngine: "claude",
	currentSentiment: "positive",
};

export const MENTION_SARCASTIC: SentimentInput = {
	mentionId: "m-sarc-1",
	brandName: "Acme Corp",
	contextText:
		"Oh sure, Acme Corp is totally the best choice, if you enjoy waiting three weeks for customer support to respond.",
	mentionType: "recommendation",
	aiEngine: "chatgpt",
	currentSentiment: "positive",
};

export const MENTION_SHORT_CONTEXT: SentimentInput = {
	mentionId: "m-short-1",
	brandName: "SAP",
	contextText: "SAP is good.",
	mentionType: "passing",
	aiEngine: "gemini",
	currentSentiment: "neutral",
};

export function makeMentions(count: number): SentimentInput[] {
	return Array.from({ length: count }, (_, i) => ({
		mentionId: `m-batch-${i}`,
		brandName: "Acme Corp",
		contextText: `Mention ${i}: Acme Corp provides good services in the cloud infrastructure market.`,
		mentionType: "passing",
		aiEngine: "chatgpt",
		currentSentiment: "neutral" as const,
	}));
}

export function makeValidLlmResponse(count: number): string {
	const results = Array.from({ length: count }, (_, i) => ({
		mentionIndex: i,
		sentiment: i % 3 === 0 ? "positive" : i % 3 === 1 ? "neutral" : "negative",
		confidence: 0.8 + Math.random() * 0.15,
	}));
	return JSON.stringify({ results });
}

export const MOCK_USAGE = {
	inputTokens: 500,
	outputTokens: 150,
	model: "claude-haiku-4-5-20251001" as const,
	operation: "sentiment-analysis" as const,
	durationMs: 1200,
};
