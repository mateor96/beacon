import type { TokenUsage } from "@beacon/shared";
import type { z } from "zod";
import { parseAiOutput } from "./schemas.js";
import type { AiResult, RetryConfig } from "./types.js";
import { DEFAULT_RETRY_CONFIG } from "./types.js";

// ── Helpers ─────────────────────────────────────────────────

export function stripJsonFences(text: string): string {
	return text
		.replace(/^```(?:json)?\s*\n?/i, "")
		.replace(/\n?```\s*$/i, "")
		.trim();
}

// ── Validated Retry ─────────────────────────────────────────

export async function withValidatedRetry<T>(options: {
	call: (prompt: string) => Promise<{ text: string; usage: TokenUsage }>;
	prompt: string;
	schema: z.ZodType<T>;
	config?: Partial<RetryConfig>;
}): Promise<AiResult<T>> {
	const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.config };
	const usageLog: TokenUsage[] = [];
	let currentPrompt = options.prompt;

	for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
		let text: string;

		try {
			const response = await options.call(currentPrompt);
			usageLog.push(response.usage);
			text = response.text;
		} catch (err) {
			return {
				ok: false,
				error: {
					code: "API_ERROR",
					message: err instanceof Error ? err.message : String(err),
					attempts: attempt + 1,
				},
				usage: usageLog,
			};
		}

		const stripped = stripJsonFences(text);
		let parsed: unknown;

		try {
			parsed = JSON.parse(stripped);
		} catch {
			if (attempt < config.maxRetries && config.feedbackErrors) {
				currentPrompt = buildFeedbackPrompt(
					options.prompt,
					text,
					"JSON-Parsing fehlgeschlagen: Ungültige JSON-Syntax.",
				);
				continue;
			}
			return {
				ok: false,
				error: {
					code: "VALIDATION_FAILED",
					message: "JSON-Parsing fehlgeschlagen",
					attempts: attempt + 1,
				},
				usage: usageLog,
			};
		}

		const result = parseAiOutput(options.schema, parsed);

		if (result.success) {
			return { ok: true, data: result.data, usage: usageLog };
		}

		if (attempt < config.maxRetries && config.feedbackErrors) {
			currentPrompt = buildFeedbackPrompt(options.prompt, text, result.error);
			continue;
		}

		return {
			ok: false,
			error: { code: "VALIDATION_FAILED", message: result.error, attempts: attempt + 1 },
			usage: usageLog,
		};
	}

	// Unreachable, but TypeScript needs it
	return {
		ok: false,
		error: {
			code: "VALIDATION_FAILED",
			message: "Max retries exceeded",
			attempts: config.maxRetries + 1,
		},
		usage: usageLog,
	};
}

function buildFeedbackPrompt(
	original: string,
	previousOutput: string,
	errorDetails: string,
): string {
	const truncated =
		previousOutput.length > 1500 ? `${previousOutput.slice(0, 1500)}...` : previousOutput;
	return `${original}\n\nDeine vorherige Antwort war ungültig:\n${truncated}\n\nFehler:\n${errorDetails}\n\nBitte korrigiere die Fehler.`;
}
