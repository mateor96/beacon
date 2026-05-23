import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock Anthropic SDK ──────────────────────────────────────

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
	default: vi.fn().mockImplementation(() => ({
		messages: { create: mockCreate },
	})),
}));

import { ClaudeClient, createClient } from "../client.js";

// ── Helpers ─────────────────────────────────────────────────

const DEFAULT_CONFIG = { apiKey: "test-key-123" };

function mockApiResponse(text = "Hello", inputTokens = 100, outputTokens = 50) {
	return {
		content: [{ type: "text" as const, text }],
		usage: { input_tokens: inputTokens, output_tokens: outputTokens },
	};
}

// ── Tests ───────────────────────────────────────────────────

describe("ClaudeClient", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("constructor defaults", () => {
		it("uses default model and settings when not specified", async () => {
			const client = new ClaudeClient(DEFAULT_CONFIG);
			mockCreate.mockResolvedValueOnce(mockApiResponse());

			await client.complete({
				systemPrompt: "test",
				userMessage: "test",
				operation: "semantic-analysis",
			});

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "claude-haiku-4-5-20251001",
					max_tokens: 4096,
					temperature: 0,
				}),
			);
		});

		it("uses custom model and settings when specified", async () => {
			const client = new ClaudeClient({
				...DEFAULT_CONFIG,
				model: "claude-sonnet-4-5-20250514",
				maxTokens: 2048,
				temperature: 0.5,
			});
			mockCreate.mockResolvedValueOnce(mockApiResponse());

			await client.complete({
				systemPrompt: "test",
				userMessage: "test",
				operation: "semantic-analysis",
			});

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "claude-sonnet-4-5-20250514",
					max_tokens: 2048,
					temperature: 0.5,
				}),
			);
		});
	});

	describe("complete()", () => {
		it("extracts text from TextBlocks and maps token usage", async () => {
			const client = new ClaudeClient(DEFAULT_CONFIG);
			mockCreate.mockResolvedValueOnce({
				content: [
					{ type: "text", text: "Hello " },
					{ type: "text", text: "World" },
				],
				usage: { input_tokens: 200, output_tokens: 80 },
			});

			const result = await client.complete({
				systemPrompt: "system",
				userMessage: "user",
				operation: "report-generation",
			});

			expect(result.text).toBe("Hello World");
			expect(result.usage).toEqual(
				expect.objectContaining({
					inputTokens: 200,
					outputTokens: 80,
					model: "claude-haiku-4-5-20251001",
					operation: "report-generation",
				}),
			);
			expect(result.usage.durationMs).toBeGreaterThanOrEqual(0);
		});

		it("filters out non-text blocks", async () => {
			const client = new ClaudeClient(DEFAULT_CONFIG);
			mockCreate.mockResolvedValueOnce({
				content: [
					{ type: "tool_use", id: "1", name: "fn", input: {} },
					{ type: "text", text: "Only text" },
				],
				usage: { input_tokens: 50, output_tokens: 20 },
			});

			const result = await client.complete({
				systemPrompt: "s",
				userMessage: "u",
				operation: "semantic-analysis",
			});

			expect(result.text).toBe("Only text");
		});

		it("allows per-call maxTokens override", async () => {
			const client = new ClaudeClient(DEFAULT_CONFIG);
			mockCreate.mockResolvedValueOnce(mockApiResponse());

			await client.complete({
				systemPrompt: "s",
				userMessage: "u",
				operation: "semantic-analysis",
				maxTokens: 512,
			});

			expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 512 }));
		});
	});

	describe("fromEnv()", () => {
		it("throws when ANTHROPIC_API_KEY is not set", () => {
			const original = process.env.ANTHROPIC_API_KEY;
			Reflect.deleteProperty(process.env, "ANTHROPIC_API_KEY");

			expect(() => ClaudeClient.fromEnv()).toThrow("ANTHROPIC_API_KEY");

			if (original) process.env.ANTHROPIC_API_KEY = original;
		});

		it("creates client when ANTHROPIC_API_KEY is set", () => {
			const original = process.env.ANTHROPIC_API_KEY;
			process.env.ANTHROPIC_API_KEY = "env-test-key";

			const client = ClaudeClient.fromEnv();
			expect(client).toBeInstanceOf(ClaudeClient);

			if (original) {
				process.env.ANTHROPIC_API_KEY = original;
			} else {
				Reflect.deleteProperty(process.env, "ANTHROPIC_API_KEY");
			}
		});
	});

	describe("createClient()", () => {
		it("uses config when provided", () => {
			const client = createClient(DEFAULT_CONFIG);
			expect(client).toBeInstanceOf(ClaudeClient);
		});

		it("falls back to fromEnv() when no config", () => {
			const original = process.env.ANTHROPIC_API_KEY;
			process.env.ANTHROPIC_API_KEY = "env-key";

			const client = createClient();
			expect(client).toBeInstanceOf(ClaudeClient);

			if (original) {
				process.env.ANTHROPIC_API_KEY = original;
			} else {
				Reflect.deleteProperty(process.env, "ANTHROPIC_API_KEY");
			}
		});
	});
});
