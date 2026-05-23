import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock Google Generative AI SDK ────────────────────────────

const mockGenerateContent = vi.fn();

vi.mock("@google/generative-ai", () => ({
	GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
		getGenerativeModel: vi.fn().mockReturnValue({
			generateContent: mockGenerateContent,
		}),
	})),
}));

import { GeminiProvider } from "../../providers/gemini.provider.js";

// ── Tests ────────────────────────────────────────────────────

describe("GeminiProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns AiQueryResult with engine 'gemini' on success", async () => {
		const original = process.env.GOOGLE_AI_API_KEY;
		process.env.GOOGLE_AI_API_KEY = "test-google-key";

		mockGenerateContent.mockResolvedValueOnce({
			response: {
				text: () => "Gemini says hello",
				usageMetadata: {
					promptTokenCount: 150,
					candidatesTokenCount: 60,
				},
			},
		});

		const provider = new GeminiProvider();
		const result = await provider.query({
			systemPrompt: "You are helpful",
			userMessage: "Tell me about this brand",
		});

		expect(result.engine).toBe("gemini");
		expect(result.text).toBe("Gemini says hello");
		expect(result.model).toBe("gemini-2.0-flash");
		expect(result.inputTokens).toBe(150);
		expect(result.outputTokens).toBe(60);
		expect(result.costCents).toBeGreaterThanOrEqual(0);
		expect(result.durationMs).toBeGreaterThanOrEqual(0);

		if (original) {
			process.env.GOOGLE_AI_API_KEY = original;
		} else {
			Reflect.deleteProperty(process.env, "GOOGLE_AI_API_KEY");
		}
	});

	it("isConfigured() returns false when GOOGLE_AI_API_KEY not set", () => {
		const original = process.env.GOOGLE_AI_API_KEY;
		Reflect.deleteProperty(process.env, "GOOGLE_AI_API_KEY");

		const provider = new GeminiProvider();
		expect(provider.isConfigured()).toBe(false);

		if (original) process.env.GOOGLE_AI_API_KEY = original;
	});

	it("throws with clear message on API error", async () => {
		const original = process.env.GOOGLE_AI_API_KEY;
		process.env.GOOGLE_AI_API_KEY = "test-google-key";

		mockGenerateContent.mockRejectedValueOnce(new Error("Quota exceeded"));

		const provider = new GeminiProvider();

		await expect(
			provider.query({
				systemPrompt: "system",
				userMessage: "user",
			}),
		).rejects.toThrow("Gemini query failed: Quota exceeded");

		if (original) {
			process.env.GOOGLE_AI_API_KEY = original;
		} else {
			Reflect.deleteProperty(process.env, "GOOGLE_AI_API_KEY");
		}
	});
});
