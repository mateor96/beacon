import { z } from "zod";

const SentimentResultItemSchema = z.object({
	mentionIndex: z.number().int().min(0),
	sentiment: z.enum(["positive", "neutral", "negative"]),
	confidence: z.number().min(0).max(1),
});

export const SentimentBatchResponseSchema = z.object({
	results: z.array(SentimentResultItemSchema).min(1).max(10),
});

export type ValidatedSentimentBatchResponse = z.infer<typeof SentimentBatchResponseSchema>;
