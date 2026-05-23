/**
 * Hardcoded pricing table for AI models.
 * Prices are in USD per 1M tokens.
 */
const PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
	// Anthropic
	"claude-haiku-4-5-20251001": { inputPerMillion: 0.8, outputPerMillion: 4.0 },
	"claude-sonnet-4-20250514": { inputPerMillion: 3.0, outputPerMillion: 15.0 },
	"claude-opus-4-20250514": { inputPerMillion: 15.0, outputPerMillion: 75.0 },

	// OpenAI
	"gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
	"gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10.0 },

	// Perplexity
	sonar: { inputPerMillion: 1.0, outputPerMillion: 1.0 },
	"sonar-pro": { inputPerMillion: 3.0, outputPerMillion: 15.0 },

	// Google
	"gemini-2.0-flash": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
	"gemini-2.5-pro-preview-05-06": { inputPerMillion: 1.25, outputPerMillion: 10.0 },
};

/**
 * Calculate cost in cents for a given model and token usage.
 * Returns 0 if the model is not found in the pricing table.
 */
export function calculateCostCents(
	model: string,
	inputTokens: number,
	outputTokens: number,
): number {
	const pricing = PRICING[model];
	if (!pricing) {
		return 0;
	}

	const inputCostUsd = (inputTokens / 1_000_000) * pricing.inputPerMillion;
	const outputCostUsd = (outputTokens / 1_000_000) * pricing.outputPerMillion;
	const totalCents = (inputCostUsd + outputCostUsd) * 100;

	return Math.round(totalCents * 10_000) / 10_000; // 4 decimal places
}
