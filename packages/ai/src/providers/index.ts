export type { AiEngine, AiHealthCheckResult, AiQueryResult, AiQueryProvider } from "./types.js";
export { calculateCostCents } from "./pricing.js";

import { ChatGptProvider } from "./chatgpt.provider.js";
import { ClaudeProvider } from "./claude.provider.js";
import { GeminiProvider } from "./gemini.provider.js";
import { PerplexityProvider } from "./perplexity.provider.js";
import type { AiQueryProvider } from "./types.js";

export { ChatGptProvider } from "./chatgpt.provider.js";
export { ClaudeProvider } from "./claude.provider.js";
export { GeminiProvider } from "./gemini.provider.js";
export { PerplexityProvider } from "./perplexity.provider.js";

export function createConfiguredProviders(): AiQueryProvider[] {
	const all = [
		new ClaudeProvider(),
		new ChatGptProvider(),
		new PerplexityProvider(),
		new GeminiProvider(),
	];
	return all.filter((p) => p.isConfigured());
}
