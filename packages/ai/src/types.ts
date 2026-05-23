import type { AiOperationType, TokenUsage } from "@beacon/shared";

// ── AI Result ───────────────────────────────────────────────

export type AiResult<T> =
	| { ok: true; data: T; usage: TokenUsage[] }
	| { ok: false; error: AiError; usage: TokenUsage[] };

export interface AiError {
	code: "VALIDATION_FAILED" | "MAX_RETRIES" | "API_ERROR" | "RATE_LIMIT" | "CONFIG_ERROR";
	message: string;
	attempts: number;
}

// ── Semantic Analysis ───────────────────────────────────────

export interface SemanticDimension {
	score: number;
	assessment: string;
}

export interface SemanticAnalysisResult {
	overallScore: number;
	clarity: SemanticDimension;
	structure: SemanticDimension;
	factDensity: SemanticDimension;
	topicFocus: SemanticDimension;
	uniqueness: SemanticDimension;
	summary: string;
	improvements: string[];
}

export interface CitationAnalysisResult {
	overallScore: number;
	quotability: SemanticDimension;
	authority: SemanticDimension;
	specificity: SemanticDimension;
	freshness: SemanticDimension;
	attribution: SemanticDimension;
	summary: string;
	improvements: string[];
}

// ── Client Config ───────────────────────────────────────────

export interface ClaudeClientConfig {
	apiKey: string;
	model?: string;
	maxTokens?: number;
	temperature?: number;
	timeoutMs?: number;
}

// ── Retry Config ────────────────────────────────────────────

export interface RetryConfig {
	maxRetries: number;
	feedbackErrors: boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxRetries: 2,
	feedbackErrors: true,
};
