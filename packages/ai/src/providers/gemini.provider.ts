import { GoogleGenerativeAI } from "@google/generative-ai";
import { calculateCostCents } from "./pricing.js";
import type { AiEngine, AiHealthCheckResult, AiQueryProvider, AiQueryResult } from "./types.js";

const MODEL = "gemini-2.0-flash";

export class GeminiProvider implements AiQueryProvider {
	readonly engine: AiEngine = "gemini";

	isConfigured(): boolean {
		return !!process.env.GOOGLE_AI_API_KEY;
	}

	async query(opts: {
		systemPrompt: string;
		userMessage: string;
		maxTokens?: number;
	}): Promise<AiQueryResult> {
		const apiKey = process.env.GOOGLE_AI_API_KEY;
		if (!apiKey) {
			throw new Error("GOOGLE_AI_API_KEY environment variable is required");
		}

		const genAI = new GoogleGenerativeAI(apiKey);
		const model = genAI.getGenerativeModel({
			model: MODEL,
			systemInstruction: opts.systemPrompt,
			generationConfig: {
				maxOutputTokens: opts.maxTokens ?? 4096,
				temperature: 0,
			},
		});

		const start = Date.now();

		try {
			const result = await model.generateContent(opts.userMessage);
			const durationMs = Date.now() - start;

			const response = result.response;
			const text = response.text();
			const usageMetadata = response.usageMetadata;

			const inputTokens = usageMetadata?.promptTokenCount ?? 0;
			const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;

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
			throw new Error(`Gemini query failed: ${message}`);
		}
	}

	async healthCheck(): Promise<AiHealthCheckResult> {
		const apiKey = process.env.GOOGLE_AI_API_KEY;
		if (!apiKey) {
			return { ok: false, latencyMs: 0, error: "GOOGLE_AI_API_KEY not set" };
		}

		const genAI = new GoogleGenerativeAI(apiKey);
		const start = Date.now();

		try {
			const model = genAI.getGenerativeModel({ model: MODEL });
			const timeoutPromise = new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error("Health check timed out")), 5000),
			);
			await Promise.race([
				model.countTokens({ contents: [{ role: "user", parts: [{ text: "ping" }] }] }),
				timeoutPromise,
			]);
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
