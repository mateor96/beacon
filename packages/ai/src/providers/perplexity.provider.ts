import OpenAI from "openai";
import { calculateCostCents } from "./pricing.js";
import type { AiEngine, AiHealthCheckResult, AiQueryProvider, AiQueryResult } from "./types.js";

const MODEL = "sonar";

export class PerplexityProvider implements AiQueryProvider {
	readonly engine: AiEngine = "perplexity";

	/** @param apiKeyOverride injected key (e.g. from DB); falls back to env. */
	constructor(private readonly apiKeyOverride?: string) {}

	private get apiKey(): string | undefined {
		return this.apiKeyOverride ?? process.env.PERPLEXITY_API_KEY;
	}

	isConfigured(): boolean {
		return !!this.apiKey;
	}

	async query(opts: {
		systemPrompt: string;
		userMessage: string;
		maxTokens?: number;
	}): Promise<AiQueryResult> {
		const apiKey = this.apiKey;
		if (!apiKey) {
			throw new Error("PERPLEXITY_API_KEY environment variable is required");
		}

		const client = new OpenAI({
			apiKey,
			baseURL: "https://api.perplexity.ai",
		});
		const start = Date.now();

		try {
			const response = await client.chat.completions.create({
				model: MODEL,
				max_tokens: opts.maxTokens ?? 4096,
				temperature: 0,
				messages: [
					{ role: "system", content: opts.systemPrompt },
					{ role: "user", content: opts.userMessage },
				],
			});

			const durationMs = Date.now() - start;

			const text = response.choices[0]?.message?.content ?? "";
			const inputTokens = response.usage?.prompt_tokens ?? 0;
			const outputTokens = response.usage?.completion_tokens ?? 0;

			return {
				engine: this.engine,
				text,
				model: MODEL,
				inputTokens,
				outputTokens,
				costCents: calculateCostCents(MODEL, inputTokens, outputTokens),
				durationMs,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Perplexity query failed: ${message}`);
		}
	}

	async healthCheck(): Promise<AiHealthCheckResult> {
		const apiKey = this.apiKey;
		if (!apiKey) {
			return { ok: false, latencyMs: 0, error: "PERPLEXITY_API_KEY not set" };
		}

		const client = new OpenAI({
			apiKey,
			baseURL: "https://api.perplexity.ai",
		});
		const start = Date.now();

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 5000);
			await client.models.list({ signal: controller.signal });
			clearTimeout(timeout);
			return { ok: true, latencyMs: Date.now() - start };
		} catch (error) {
			return {
				ok: false,
				latencyMs: Date.now() - start,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}
}
