import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateAgentsMdFix } from "../../generators/fix-agents-md.js";
import {
	MINIMAL_HTML,
	VALID_AGENTS_MD_RESPONSE,
	createContext,
	createMockClient,
} from "./fixtures.js";

describe("generateAgentsMdFix", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns valid fix for sufficient HTML", async () => {
		const client = createMockClient(VALID_AGENTS_MD_RESPONSE);
		const ctx = createContext("agents-md");

		const result = await generateAgentsMdFix(ctx, client);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.checkId).toBe("agents-md");
			expect(result.data.filename).toBe("agents.md");
			expect(result.data.method).toBe("ai-generated");
		}
	});

	it("returns error for minimal HTML", async () => {
		const client = createMockClient(VALID_AGENTS_MD_RESPONSE);
		const ctx = createContext("agents-md", { html: MINIMAL_HTML });

		const result = await generateAgentsMdFix(ctx, client);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("VALIDATION_FAILED");
			expect(result.error.attempts).toBe(0);
		}
	});

	it("passes fix-generation as operation type", async () => {
		const client = createMockClient(VALID_AGENTS_MD_RESPONSE);
		const ctx = createContext("agents-md");

		await generateAgentsMdFix(ctx, client);

		const call = (client as unknown as { complete: ReturnType<typeof vi.fn> }).complete;
		expect(call.mock.calls[0][0].operation).toBe("fix-generation");
	});

	it("includes URL in user message", async () => {
		const client = createMockClient(VALID_AGENTS_MD_RESPONSE);
		const ctx = createContext("agents-md");

		await generateAgentsMdFix(ctx, client);

		const call = (client as unknown as { complete: ReturnType<typeof vi.fn> }).complete;
		expect(call.mock.calls[0][0].userMessage).toContain("https://example.com");
	});
});
