import { describe, expect, it } from "vitest";
import {
	type PromptLlmClient,
	generateSuggestedPrompts,
	getIndustryTemplates,
	listSupportedIndustries,
	parseLlmResponse,
	renderFallbackTemplates,
} from "../suggestions/index.js";

describe("parseLlmResponse", () => {
	it("parses an object with `prompts` field", () => {
		const out = parseLlmResponse(
			JSON.stringify({
				prompts: [{ prompt: "Q1", category: "brand", relevance_score: 0.9 }],
			}),
			"en",
		);
		expect(out).toEqual([
			{ prompt: "Q1", category: "brand", relevance_score: 0.9, language: "en" },
		]);
	});

	it("parses a bare top-level array", () => {
		const out = parseLlmResponse(
			JSON.stringify([{ prompt: "Q1", category: "brand", relevance_score: 1 }]),
			"de",
		);
		expect(out).toHaveLength(1);
		expect(out[0]?.language).toBe("de");
	});

	it("strips ```json code fences", () => {
		const wrapped =
			'```json\n{"prompts":[{"prompt":"X","category":"brand","relevance_score":0.5}]}\n```';
		expect(parseLlmResponse(wrapped, "en")).toHaveLength(1);
	});

	it("returns [] on invalid JSON", () => {
		expect(parseLlmResponse("not json", "en")).toEqual([]);
	});

	it("discards entries with empty prompt", () => {
		const out = parseLlmResponse(
			JSON.stringify({
				prompts: [
					{ prompt: "", category: "brand", relevance_score: 0.5 },
					{ prompt: "Valid", category: "brand", relevance_score: 0.5 },
				],
			}),
			"en",
		);
		expect(out).toHaveLength(1);
		expect(out[0]?.prompt).toBe("Valid");
	});

	it("clamps relevance_score to [0, 1]", () => {
		const out = parseLlmResponse(
			JSON.stringify({
				prompts: [
					{ prompt: "A", category: "brand", relevance_score: 5 },
					{ prompt: "B", category: "brand", relevance_score: -1 },
				],
			}),
			"en",
		);
		expect(out[0]?.relevance_score).toBe(1);
		expect(out[1]?.relevance_score).toBe(0);
	});

	it("defaults relevance_score to 0.5 when missing/non-numeric", () => {
		const out = parseLlmResponse(
			JSON.stringify({
				prompts: [{ prompt: "X", category: "brand" }],
			}),
			"en",
		);
		expect(out[0]?.relevance_score).toBe(0.5);
	});
});

describe("renderFallbackTemplates", () => {
	it("interpolates brand_name into the SaaS templates (DE)", () => {
		const out = renderFallbackTemplates({
			brandName: "Acme",
			industry: "saas",
			language: "de",
		});
		const joined = out.map((p) => p.prompt).join(" | ");
		expect(joined).toContain("Acme");
	});

	it("returns the generic pack for less-common industries", () => {
		const out = renderFallbackTemplates({
			brandName: "Acme",
			industry: "healthcare",
			language: "en",
		});
		expect(out.length).toBeGreaterThan(0);
		expect(out.every((p) => p.language === "en")).toBe(true);
	});

	it("every returned prompt has a category and relevance_score", () => {
		for (const industry of listSupportedIndustries()) {
			for (const lang of ["de", "en"] as const) {
				const out = renderFallbackTemplates({
					brandName: "Acme",
					industry,
					language: lang,
				});
				for (const p of out) {
					expect(p.category).toBeTruthy();
					expect(p.relevance_score).toBeGreaterThan(0);
					expect(p.relevance_score).toBeLessThanOrEqual(1);
				}
			}
		}
	});
});

describe("generateSuggestedPrompts", () => {
	it("uses the LLM when provided and returns its parsed output", async () => {
		const llm: PromptLlmClient = {
			generate: async () =>
				JSON.stringify({
					prompts: [{ prompt: "Is Acme a good SaaS?", category: "brand", relevance_score: 0.9 }],
				}),
		};
		const out = await generateSuggestedPrompts(
			{ brandName: "Acme", industry: "saas", language: "en" },
			llm,
		);
		expect(out).toHaveLength(1);
		expect(out[0]?.prompt).toBe("Is Acme a good SaaS?");
	});

	it("falls back to templates when no LLM is provided", async () => {
		const out = await generateSuggestedPrompts({
			brandName: "Acme",
			industry: "saas",
			language: "de",
		});
		expect(out.length).toBeGreaterThan(0);
		expect(out.every((p) => p.prompt.includes("Acme") || !p.prompt.includes("{{"))).toBe(true);
	});

	it("falls back when the LLM returns garbage", async () => {
		const llm: PromptLlmClient = {
			generate: async () => "not json at all",
		};
		const out = await generateSuggestedPrompts(
			{ brandName: "Acme", industry: "saas", language: "en" },
			llm,
		);
		expect(out.length).toBeGreaterThan(0);
	});

	it("falls back when the LLM throws", async () => {
		const llm: PromptLlmClient = {
			generate: async () => {
				throw new Error("rate limited");
			},
		};
		const out = await generateSuggestedPrompts(
			{ brandName: "Acme", industry: "saas", language: "en" },
			llm,
		);
		expect(out.length).toBeGreaterThan(0);
	});

	it("respects the limit parameter", async () => {
		const out = await generateSuggestedPrompts({
			brandName: "Acme",
			industry: "saas",
			language: "de",
			limit: 1,
		});
		expect(out).toHaveLength(1);
	});
});

describe("getIndustryTemplates", () => {
	it("returns packs for every supported industry in both DE/EN", () => {
		for (const industry of listSupportedIndustries()) {
			expect(getIndustryTemplates(industry, "de").length).toBeGreaterThan(0);
			expect(getIndustryTemplates(industry, "en").length).toBeGreaterThan(0);
		}
	});
});
