import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetLocaleByCode, mockGetLocaleById, mockGetTemplate } = vi.hoisted(() => ({
	mockGetLocaleByCode: vi.fn(),
	mockGetLocaleById: vi.fn(),
	mockGetTemplate: vi.fn(),
}));

vi.mock("@beacon/db", () => ({
	db: {},
	localeQueries: {
		getLocaleByCode: (...args: unknown[]) => mockGetLocaleByCode(...args),
		getLocaleById: (...args: unknown[]) => mockGetLocaleById(...args),
		getTemplate: (...args: unknown[]) => mockGetTemplate(...args),
	},
}));

import { __resetLocalePromptCache, loadLocalePrompt } from "../lib/locale-prompt";

const deRow = {
	id: "de-uuid",
	countryCode: "DE",
	languageCode: "de",
	displayName: "Deutsch (Deutschland)",
	regionContext: { ai_assistants: ["ChatGPT"] },
	isActive: 1,
};

const frRow = {
	id: "fr-uuid",
	countryCode: "FR",
	languageCode: "fr",
	displayName: "Francais (France)",
	regionContext: { ai_assistants: ["Mistral"] },
	isActive: 1,
};

describe("loadLocalePrompt", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		__resetLocalePromptCache();
		mockGetLocaleByCode.mockResolvedValue(deRow);
	});

	it("happy path: requested locale template is rendered", async () => {
		mockGetLocaleById.mockResolvedValue(frRow);
		mockGetTemplate.mockResolvedValueOnce({
			id: "t1",
			localeId: "fr-uuid",
			key: "readiness_check",
			category: "system",
			content: "You are an assistant. language={{language}} country={{country}}",
			variables: [],
			version: 1,
		});

		const result = await loadLocalePrompt({} as never, {
			requestedLocaleId: "fr-uuid",
			key: "readiness_check",
			hardcodedFallback: "FALLBACK",
		});

		expect(result.usedFallback).toBe(false);
		expect(result.usedHardcodedDefault).toBe(false);
		expect(result.systemPrompt).toContain("language=fr");
		expect(result.systemPrompt).toContain("country=FR");
		expect(result.resolvedLocaleId).toBe("fr-uuid");
		expect(result.languageCode).toBe("fr");
	});

	it("null localeId → de-DE fallback template is used", async () => {
		mockGetLocaleById.mockResolvedValue(deRow);
		mockGetTemplate.mockResolvedValueOnce({
			id: "t2",
			localeId: "de-uuid",
			key: "readiness_check",
			category: "system",
			content: "Du bist ein KI-Analyst. Sprache={{language}}",
			variables: [],
			version: 1,
		});

		const result = await loadLocalePrompt({} as never, {
			requestedLocaleId: null,
			key: "readiness_check",
			hardcodedFallback: "FALLBACK",
		});

		expect(result.systemPrompt).toContain("Sprache=de");
		expect(result.resolvedLocaleId).toBe("de-uuid");
		// Treated as a fallback path — caller had no requested locale so
		// de-DE kicked in. Observable in telemetry.
		expect(result.usedFallback).toBe(true);
		expect(result.usedHardcodedDefault).toBe(false);
	});

	it("missing primary template → de-DE fallback", async () => {
		mockGetLocaleById.mockResolvedValue(frRow);
		// first getTemplate: requested (fr) → null; second: de fallback → present
		mockGetTemplate.mockResolvedValueOnce(null).mockResolvedValueOnce({
			id: "t3",
			localeId: "de-uuid",
			key: "readiness_check",
			category: "system",
			content: "DE fallback sprache={{language}}",
			variables: [],
			version: 1,
		});

		const result = await loadLocalePrompt({} as never, {
			requestedLocaleId: "fr-uuid",
			key: "readiness_check",
			hardcodedFallback: "FALLBACK",
		});

		// The fallback was the DE template, but buildLocaleVariables used
		// the FR row (active locale), so language=fr in the variable bag.
		expect(result.systemPrompt).toContain("sprache=fr");
		expect(result.usedFallback).toBe(true);
		expect(result.usedHardcodedDefault).toBe(false);
	});

	it("both missing → hardcoded default", async () => {
		mockGetLocaleById.mockResolvedValue(frRow);
		mockGetTemplate.mockResolvedValue(null);

		const result = await loadLocalePrompt({} as never, {
			requestedLocaleId: "fr-uuid",
			key: "readiness_check",
			hardcodedFallback: "HARDCODED_STRING",
		});

		expect(result.systemPrompt).toBe("HARDCODED_STRING");
		expect(result.usedHardcodedDefault).toBe(true);
		expect(result.resolvedLocaleId).toBeNull();
	});

	it("unresolved placeholder rethrows", async () => {
		mockGetLocaleById.mockResolvedValue(frRow);
		mockGetTemplate.mockResolvedValueOnce({
			id: "t4",
			localeId: "fr-uuid",
			key: "readiness_check",
			category: "system",
			content: "Missing {{unknown_var}} here",
			variables: [],
			version: 1,
		});

		await expect(
			loadLocalePrompt({} as never, {
				requestedLocaleId: "fr-uuid",
				key: "readiness_check",
				hardcodedFallback: "FALLBACK",
			}),
		).rejects.toThrow(/unknown_var/);
	});

	it("caches de-DE fallback locale id across calls", async () => {
		mockGetLocaleById.mockResolvedValue(frRow);
		mockGetTemplate.mockResolvedValue({
			id: "t5",
			localeId: "fr-uuid",
			key: "readiness_check",
			category: "system",
			content: "language={{language}}",
			variables: [],
			version: 1,
		});

		await loadLocalePrompt({} as never, {
			requestedLocaleId: "fr-uuid",
			key: "readiness_check",
			hardcodedFallback: "FALLBACK",
		});
		await loadLocalePrompt({} as never, {
			requestedLocaleId: "fr-uuid",
			key: "readiness_check",
			hardcodedFallback: "FALLBACK",
		});

		expect(mockGetLocaleByCode).toHaveBeenCalledTimes(1);
	});
});
