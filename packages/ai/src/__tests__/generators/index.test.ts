import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateFix } from "../../generators/index.js";
import {
	VALID_AGENTS_MD_RESPONSE,
	VALID_LLMS_TXT_RESPONSE,
	VALID_META_TAGS_RESPONSE,
	VALID_SCHEMA_ORG_RESPONSE,
	createContext,
	createMockClient,
} from "./fixtures.js";

describe("generateFix dispatcher", () => {
	beforeEach(() => vi.clearAllMocks());

	it("routes llms-txt to the correct generator", async () => {
		const client = createMockClient(VALID_LLMS_TXT_RESPONSE);
		const ctx = createContext("llms-txt");

		const result = await generateFix("llms-txt", ctx, client);

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data.checkId).toBe("llms-txt");
	});

	it("routes robots-txt to the rule-based generator", async () => {
		const client = createMockClient("unused");
		const ctx = createContext("robots-txt");

		const result = await generateFix("robots-txt", ctx, client);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.checkId).toBe("robots-txt");
			expect(result.data.method).toBe("rule-based");
		}
		// No API call should have been made
		expect(result.usage).toEqual([]);
	});

	it("routes schema-org to the correct generator", async () => {
		const client = createMockClient(VALID_SCHEMA_ORG_RESPONSE);
		const ctx = createContext("schema-org");

		const result = await generateFix("schema-org", ctx, client);

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data.checkId).toBe("schema-org");
	});

	it("routes meta-tags to the correct generator", async () => {
		const client = createMockClient(VALID_META_TAGS_RESPONSE);
		const ctx = createContext("meta-tags");

		const result = await generateFix("meta-tags", ctx, client);

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data.checkId).toBe("meta-tags");
	});

	it("routes agents-md to the correct generator", async () => {
		const client = createMockClient(VALID_AGENTS_MD_RESPONSE);
		const ctx = createContext("agents-md");

		const result = await generateFix("agents-md", ctx, client);

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data.checkId).toBe("agents-md");
	});
});
