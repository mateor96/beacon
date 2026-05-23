import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateMetaTagsFix } from "../../generators/fix-meta-tags.js";
import {
	MINIMAL_HTML,
	VALID_META_TAGS_RESPONSE,
	createContext,
	createMockClient,
} from "./fixtures.js";

describe("generateMetaTagsFix", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns valid fix for sufficient HTML", async () => {
		const client = createMockClient(VALID_META_TAGS_RESPONSE);
		const ctx = createContext("meta-tags");

		const result = await generateMetaTagsFix(ctx, client);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.checkId).toBe("meta-tags");
			expect(result.data.filename).toBe("meta-tags.html");
			expect(result.data.method).toBe("ai-generated");
		}
	});

	it("returns error for minimal HTML", async () => {
		const client = createMockClient(VALID_META_TAGS_RESPONSE);
		const ctx = createContext("meta-tags", { html: MINIMAL_HTML });

		const result = await generateMetaTagsFix(ctx, client);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("VALIDATION_FAILED");
			expect(result.error.attempts).toBe(0);
		}
	});

	it("passes fix-generation as operation type", async () => {
		const client = createMockClient(VALID_META_TAGS_RESPONSE);
		const ctx = createContext("meta-tags");

		await generateMetaTagsFix(ctx, client);

		const call = (client as unknown as { complete: ReturnType<typeof vi.fn> }).complete;
		expect(call.mock.calls[0][0].operation).toBe("fix-generation");
	});

	it("includes URL in user message", async () => {
		const client = createMockClient(VALID_META_TAGS_RESPONSE);
		const ctx = createContext("meta-tags");

		await generateMetaTagsFix(ctx, client);

		const call = (client as unknown as { complete: ReturnType<typeof vi.fn> }).complete;
		expect(call.mock.calls[0][0].userMessage).toContain("https://example.com");
	});
});
