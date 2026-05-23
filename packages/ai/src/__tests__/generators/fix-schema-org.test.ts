import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateSchemaOrgFix } from "../../generators/fix-schema-org.js";
import {
	MINIMAL_HTML,
	VALID_SCHEMA_ORG_RESPONSE,
	createContext,
	createMockClient,
} from "./fixtures.js";

describe("generateSchemaOrgFix", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns valid fix for sufficient HTML", async () => {
		const client = createMockClient(VALID_SCHEMA_ORG_RESPONSE);
		const ctx = createContext("schema-org");

		const result = await generateSchemaOrgFix(ctx, client);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.checkId).toBe("schema-org");
			expect(result.data.filename).toBe("schema.jsonld");
			expect(result.data.method).toBe("ai-generated");
		}
	});

	it("returns error for minimal HTML", async () => {
		const client = createMockClient(VALID_SCHEMA_ORG_RESPONSE);
		const ctx = createContext("schema-org", { html: MINIMAL_HTML });

		const result = await generateSchemaOrgFix(ctx, client);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("VALIDATION_FAILED");
			expect(result.error.attempts).toBe(0);
		}
	});

	it("passes fix-generation as operation type", async () => {
		const client = createMockClient(VALID_SCHEMA_ORG_RESPONSE);
		const ctx = createContext("schema-org");

		await generateSchemaOrgFix(ctx, client);

		const call = (client as unknown as { complete: ReturnType<typeof vi.fn> }).complete;
		expect(call.mock.calls[0][0].operation).toBe("fix-generation");
	});

	it("includes URL in user message", async () => {
		const client = createMockClient(VALID_SCHEMA_ORG_RESPONSE);
		const ctx = createContext("schema-org");

		await generateSchemaOrgFix(ctx, client);

		const call = (client as unknown as { complete: ReturnType<typeof vi.fn> }).complete;
		expect(call.mock.calls[0][0].userMessage).toContain("https://example.com");
	});
});
