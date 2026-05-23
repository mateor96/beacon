import Anthropic from "@anthropic-ai/sdk";
import type { AiModel, AiOperationType, TokenUsage } from "@beacon/shared";
import type { ClaudeClientConfig } from "./types.js";

const DEFAULT_MODEL: AiModel = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0;
const DEFAULT_TIMEOUT_MS = 30_000;

export class ClaudeClient {
	private readonly anthropic: Anthropic;
	private readonly model: AiModel;
	private readonly maxTokens: number;
	private readonly temperature: number;
	private readonly timeoutMs: number;

	constructor(config: ClaudeClientConfig) {
		this.anthropic = new Anthropic({ apiKey: config.apiKey });
		this.model = (config.model as AiModel) ?? DEFAULT_MODEL;
		this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
		this.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
		this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	}

	async complete(options: {
		systemPrompt: string;
		userMessage: string;
		operation: AiOperationType;
		maxTokens?: number;
	}): Promise<{ text: string; usage: TokenUsage }> {
		const start = Date.now();

		const response = await this.anthropic.messages.create({
			model: this.model,
			max_tokens: options.maxTokens ?? this.maxTokens,
			temperature: this.temperature,
			system: options.systemPrompt,
			messages: [{ role: "user", content: options.userMessage }],
		});

		const durationMs = Date.now() - start;

		const text = response.content
			.filter((block): block is Anthropic.TextBlock => block.type === "text")
			.map((block) => block.text)
			.join("");

		const usage: TokenUsage = {
			inputTokens: response.usage.input_tokens,
			outputTokens: response.usage.output_tokens,
			model: this.model,
			operation: options.operation,
			durationMs,
		};

		return { text, usage };
	}

	/** Returns the configured model id. Used by callers that need to bind
	 * provenance (e.g. cache keys) to the actual model used at request time. */
	getModel(): AiModel {
		return this.model;
	}

	static fromEnv(): ClaudeClient {
		const apiKey = process.env.ANTHROPIC_API_KEY;
		if (!apiKey) {
			throw new Error("ANTHROPIC_API_KEY environment variable is required but not set");
		}
		return new ClaudeClient({ apiKey });
	}
}

export function createClient(config?: ClaudeClientConfig): ClaudeClient {
	return config ? new ClaudeClient(config) : ClaudeClient.fromEnv();
}
