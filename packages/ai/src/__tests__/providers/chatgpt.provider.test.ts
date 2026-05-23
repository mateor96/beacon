import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock OpenAI SDK ──────────────────────────────────────────

const mockCreate = vi.fn();

vi.mock("openai", () => ({
	default: vi.fn().mockImplementation(() => ({
		chat: { completions: { create: mockCreate } },
	})),
}));

import { ChatGptProvider } from "../../providers/chatgpt.provider.js";

// ── Tests ────────────────────────────────────────────────────

describe("ChatGptProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns AiQueryResult with engine 'chatgpt' on success", async () => {
		const original = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "test-openai-key";

		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: "AI response about brand" } }],
			usage: { prompt_tokens: 200, completion_tokens: 80 },
		});

		const provider = new ChatGptProvider();
		const result = await provider.query({
			systemPrompt: "You are helpful",
			userMessage: "Tell me about this brand",
		});

		expect(result.engine).toBe("chatgpt");
		expect(result.text).toBe("AI response about brand");
		expect(result.model).toBe("gpt-4o-mini");
		expect(result.inputTokens).toBe(200);
		expect(result.outputTokens).toBe(80);
		expect(result.costCents).toBeGreaterThanOrEqual(0);
		expect(result.durationMs).toBeGreaterThanOrEqual(0);

		if (original) {
			process.env.OPENAI_API_KEY = original;
		} else {
			Reflect.deleteProperty(process.env, "OPENAI_API_KEY");
		}
	});

	it("isConfigured() returns false when OPENAI_API_KEY not set", () => {
		const original = process.env.OPENAI_API_KEY;
		Reflect.deleteProperty(process.env, "OPENAI_API_KEY");

		const provider = new ChatGptProvider();
		expect(provider.isConfigured()).toBe(false);

		if (original) process.env.OPENAI_API_KEY = original;
	});

	it("throws with clear message on API error", async () => {
		const original = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "test-openai-key";

		mockCreate.mockRejectedValueOnce(new Error("Rate limit exceeded"));

		const provider = new ChatGptProvider();

		await expect(
			provider.query({
				systemPrompt: "system",
				userMessage: "user",
			}),
		).rejects.toThrow("ChatGPT query failed: Rate limit exceeded");

		if (original) {
			process.env.OPENAI_API_KEY = original;
		} else {
			Reflect.deleteProperty(process.env, "OPENAI_API_KEY");
		}
	});
});
