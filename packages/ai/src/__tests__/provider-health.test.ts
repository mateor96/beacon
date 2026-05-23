import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock OpenAI SDK (used by ChatGPT provider) ─────────────
const mockModelsList = vi.fn();

vi.mock("openai", () => ({
	default: vi.fn().mockImplementation(() => ({
		models: { list: mockModelsList },
		chat: { completions: { create: vi.fn() } },
	})),
}));

import { ChatGptProvider } from "../providers/chatgpt.provider.js";

describe("AiQueryProvider.healthCheck", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns ok:true and latencyMs when API responds", async () => {
		const original = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "test-key";

		mockModelsList.mockResolvedValueOnce({ data: [{ id: "gpt-4o-mini" }] });

		const provider = new ChatGptProvider();
		const result = await provider.healthCheck();

		expect(result.ok).toBe(true);
		expect(result.latencyMs).toBeGreaterThanOrEqual(0);
		expect(result.error).toBeUndefined();

		if (original) {
			process.env.OPENAI_API_KEY = original;
		} else {
			Reflect.deleteProperty(process.env, "OPENAI_API_KEY");
		}
	});

	it("returns ok:false with error when API key is missing", async () => {
		const original = process.env.OPENAI_API_KEY;
		Reflect.deleteProperty(process.env, "OPENAI_API_KEY");

		const provider = new ChatGptProvider();
		const result = await provider.healthCheck();

		expect(result.ok).toBe(false);
		expect(result.latencyMs).toBe(0);
		expect(result.error).toBe("OPENAI_API_KEY not set");

		if (original) process.env.OPENAI_API_KEY = original;
	});

	it("returns ok:false with error message on API error", async () => {
		const original = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "test-key";

		mockModelsList.mockRejectedValueOnce(new Error("Connection refused"));

		const provider = new ChatGptProvider();
		const result = await provider.healthCheck();

		expect(result.ok).toBe(false);
		expect(result.latencyMs).toBeGreaterThanOrEqual(0);
		expect(result.error).toBe("Connection refused");

		if (original) {
			process.env.OPENAI_API_KEY = original;
		} else {
			Reflect.deleteProperty(process.env, "OPENAI_API_KEY");
		}
	});
});
