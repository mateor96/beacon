import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock OpenAI SDK (Perplexity uses it with custom baseURL) ─

const mockCreate = vi.fn();

vi.mock("openai", () => ({
	default: vi.fn().mockImplementation(() => ({
		chat: { completions: { create: mockCreate } },
	})),
}));

import { PerplexityProvider } from "../../providers/perplexity.provider.js";

// ── Tests ────────────────────────────────────────────────────

describe("PerplexityProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns AiQueryResult with engine 'perplexity' on success", async () => {
		const original = process.env.PERPLEXITY_API_KEY;
		process.env.PERPLEXITY_API_KEY = "test-pplx-key";

		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: "Perplexity found this brand" } }],
			usage: { prompt_tokens: 300, completion_tokens: 120 },
		});

		const provider = new PerplexityProvider();
		const result = await provider.query({
			systemPrompt: "You are helpful",
			userMessage: "Tell me about this brand",
		});

		expect(result.engine).toBe("perplexity");
		expect(result.text).toBe("Perplexity found this brand");
		expect(result.model).toBe("sonar");
		expect(result.inputTokens).toBe(300);
		expect(result.outputTokens).toBe(120);
		expect(result.costCents).toBeGreaterThanOrEqual(0);
		expect(result.durationMs).toBeGreaterThanOrEqual(0);

		if (original) {
			process.env.PERPLEXITY_API_KEY = original;
		} else {
			Reflect.deleteProperty(process.env, "PERPLEXITY_API_KEY");
		}
	});

	it("isConfigured() returns false when PERPLEXITY_API_KEY not set", () => {
		const original = process.env.PERPLEXITY_API_KEY;
		Reflect.deleteProperty(process.env, "PERPLEXITY_API_KEY");

		const provider = new PerplexityProvider();
		expect(provider.isConfigured()).toBe(false);

		if (original) process.env.PERPLEXITY_API_KEY = original;
	});

	it("throws with clear message on API error", async () => {
		const original = process.env.PERPLEXITY_API_KEY;
		process.env.PERPLEXITY_API_KEY = "test-pplx-key";

		mockCreate.mockRejectedValueOnce(new Error("Service unavailable"));

		const provider = new PerplexityProvider();

		await expect(
			provider.query({
				systemPrompt: "system",
				userMessage: "user",
			}),
		).rejects.toThrow("Perplexity query failed: Service unavailable");

		if (original) {
			process.env.PERPLEXITY_API_KEY = original;
		} else {
			Reflect.deleteProperty(process.env, "PERPLEXITY_API_KEY");
		}
	});
});
