import Anthropic from "@anthropic-ai/sdk";
import { calculateCostCents } from "./pricing.js";
import type { AiEngine, AiHealthCheckResult, AiQueryProvider, AiQueryResult } from "./types.js";

const MODEL = "claude-haiku-4-5-20251001";

export class ClaudeProvider implements AiQueryProvider {
	readonly engine: AiEngine = "claude";

	isConfigured(): boolean {
		return !!process.env.ANTHROPIC_API_KEY;
	}

	async query(opts: {
		systemPrompt: string;
		userMessage: string;
		maxTokens?: number;
	}): Promise<AiQueryResult> {
		const apiKey = process.env.ANTHROPIC_API_KEY;
		if (!apiKey) {
			throw new Error("ANTHROPIC_API_KEY environment variable is required");
		}

		const client = new Anthropic({ apiKey });
		const start = Date.now();

		try {
			const response = await client.messages.create({
				model: MODEL,
				max_tokens: opts.maxTokens ?? 4096,
				temperature: 0,
				system: opts.systemPrompt,
				messages: [{ role: "user", content: opts.userMessage }],
			});

			const durationMs = Date.now() - start;

			const text = response.content
				.filter((block): block is Anthropic.TextBlock => block.type === "text")
				.map((block) => block.text)
				.join("");

			const inputTokens = response.usage.input_tokens;
			const outputTokens = response.usage.output_tokens;

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
			throw new Error(`Claude query failed: ${message}`);
		}
	}

	async healthCheck(): Promise<AiHealthCheckResult> {
		const apiKey = process.env.ANTHROPIC_API_KEY;
		if (!apiKey) {
			return { ok: false, latencyMs: 0, error: "ANTHROPIC_API_KEY not set" };
		}

		const client = new Anthropic({ apiKey });
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
