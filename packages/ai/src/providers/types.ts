export type AiEngine = "chatgpt" | "perplexity" | "gemini" | "claude";

export interface AiQueryResult {
	engine: AiEngine;
	text: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	costCents: number;
	durationMs: number;
}

export interface AiHealthCheckResult {
	ok: boolean;
	latencyMs: number;
	error?: string;
}

export interface AiQueryProvider {
	readonly engine: AiEngine;
	isConfigured(): boolean;
	query(opts: {
		systemPrompt: string;
		userMessage: string;
		maxTokens?: number;
	}): Promise<AiQueryResult>;
	healthCheck(): Promise<AiHealthCheckResult>;
}
