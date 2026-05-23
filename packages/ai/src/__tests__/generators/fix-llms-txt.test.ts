import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateLlmsTxtFix } from "../../generators/fix-llms-txt.js";
import {
	MINIMAL_HTML,
	VALID_LLMS_TXT_RESPONSE,
	createContext,
	createMockClient,
} from "./fixtures.js";

describe("generateLlmsTxtFix", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns valid fix for sufficient HTML", async () => {
		const client = createMockClient(VALID_LLMS_TXT_RESPONSE);
		const ctx = createContext("llms-txt");

		const result = await generateLlmsTxtFix(ctx, client);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.checkId).toBe("llms-txt");
			expect(result.data.filename).toBe("llms.txt");
			expect(result.data.method).toBe("ai-generated");
			expect(result.data.content.length).toBeGreaterThan(0);
		}
		expect(result.usage.length).toBeGreaterThan(0);
	});

	it("returns error for minimal HTML", async () => {
		const client = createMockClient(VALID_LLMS_TXT_RESPONSE);
		const ctx = createContext("llms-txt", { html: MINIMAL_HTML });

		const result = await generateLlmsTxtFix(ctx, client);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("VALIDATION_FAILED");
			expect(result.error.attempts).toBe(0);
		}
	});

	it("passes fix-generation as operation type", async () => {
		const client = createMockClient(VALID_LLMS_TXT_RESPONSE);
		const ctx = createContext("llms-txt");

		await generateLlmsTxtFix(ctx, client);

		const call = (client as unknown as { complete: ReturnType<typeof vi.fn> }).complete;
		expect(call.mock.calls[0][0].operation).toBe("fix-generation");
	});

	it("includes URL in user message", async () => {
		const client = createMockClient(VALID_LLMS_TXT_RESPONSE);
		const ctx = createContext("llms-txt");

		await generateLlmsTxtFix(ctx, client);

		const call = (client as unknown as { complete: ReturnType<typeof vi.fn> }).complete;
		expect(call.mock.calls[0][0].userMessage).toContain("https://example.com");
	});
});
