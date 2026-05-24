export type { AiEngine, AiHealthCheckResult, AiQueryResult, AiQueryProvider } from "./types.js";
export { calculateCostCents } from "./pricing.js";

import { ChatGptProvider } from "./chatgpt.provider.js";
import { ClaudeProvider } from "./claude.provider.js";
import { GeminiProvider } from "./gemini.provider.js";
import { PerplexityProvider } from "./perplexity.provider.js";
import type { AiEngine, AiQueryProvider } from "./types.js";

export { ChatGptProvider } from "./chatgpt.provider.js";
export { ClaudeProvider } from "./claude.provider.js";
export { GeminiProvider } from "./gemini.provider.js";
export { PerplexityProvider } from "./perplexity.provider.js";

/**
 * Builds the list of configured providers. Optional `keys` inject per-engine
 * API keys (e.g. resolved from the DB); engines without an injected key fall
 * back to their env var. Backward compatible — called with no args, behaviour
 * is identical to reading env directly.
 */
export function createConfiguredProviders(
	keys?: Partial<Record<AiEngine, string>>,
): AiQueryProvider[] {
	const all = [
		new ClaudeProvider(keys?.claude),
		new ChatGptProvider(keys?.chatgpt),
		new PerplexityProvider(keys?.perplexity),
		new GeminiProvider(keys?.gemini),
	];
	return all.filter((p) => p.isConfigured());
}
