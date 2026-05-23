export interface SentimentInput {
	/** DB UUID of the mention (not sent to LLM, used for mapping). */
	mentionId: string;
	/** Brand name for context. */
	brandName: string;
	/** Surrounding text from mention extraction (~300 chars). */
	contextText: string;
	/** How the mention was classified (recommendation/comparison/citation/passing). */
	mentionType: string;
	/** Which AI engine produced this response. */
	aiEngine: string;
	/** Current keyword-based sentiment (used as fallback). */
	currentSentiment: "positive" | "neutral" | "negative";
}

export interface SentimentResultItem {
	mentionIndex: number;
	sentiment: "positive" | "neutral" | "negative";
	confidence: number;
}

export interface SentimentBatchResult {
	classifications: Array<{
		mentionId: string;
		sentiment: "positive" | "neutral" | "negative";
		confidence: number;
		source: "llm" | "keyword";
	}>;
	fallbackUsed: boolean;
	costCents: number;
}
