import { renderTemplate } from "../prompts/locale-templates.js";
import {
	type IndustryPromptTemplate,
	type SupportedIndustry,
	type SupportedLanguage,
	getIndustryTemplates,
	listSupportedIndustries,
} from "./industry-templates.js";

export type { IndustryPromptTemplate, SupportedIndustry, SupportedLanguage };
export { listSupportedIndustries };

export interface SuggestedPrompt {
	prompt: string;
	category: string;
	relevance_score: number;
	language: SupportedLanguage;
}

export interface GenerateSuggestedPromptsInput {
	brandName: string;
	domain?: string | null;
	industry: SupportedIndustry;
	language: SupportedLanguage;
	existingKeywords?: string[];
	/** Hard cap on the number of prompts returned. */
	limit?: number;
}

/**
 * Injected LLM adapter. Real production wiring passes Claude Haiku
 * (cost-effective per issue #203); tests inject a stub.
 */
export interface PromptLlmClient {
	generate(prompt: string): Promise<string>;
}

const SYSTEM_PROMPT_DE = `Du bist ein Assistent für AI-Visibility-Monitoring. Erzeuge 5-10 praegnante
Monitoring-Prompts, die ein Nutzer in ChatGPT/Claude/Perplexity stellen würde,
um zu prüfen, ob eine Marke erwähnt wird. Nur JSON zurückgeben, kein Prosa:
{ "prompts": [{ "prompt": "string", "category": "brand|comparison|product|reputation", "relevance_score": 0..1 }] }`;

const SYSTEM_PROMPT_EN = `You are an AI-visibility-monitoring assistant. Generate 5-10 concise monitoring
prompts a user would type into ChatGPT/Claude/Perplexity to check whether a
brand surfaces. Return JSON only, no prose:
{ "prompts": [{ "prompt": "string", "category": "brand|comparison|product|reputation", "relevance_score": 0..1 }] }`;

function buildUserPrompt(input: GenerateSuggestedPromptsInput): string {
	const lines = [
		`Brand: ${input.brandName}`,
		input.domain ? `Domain: ${input.domain}` : null,
		`Industry: ${input.industry}`,
		`Language: ${input.language}`,
	];
	if (input.existingKeywords && input.existingKeywords.length > 0) {
		lines.push(`Existing keywords: ${input.existingKeywords.join(", ")}`);
	}
	return lines.filter(Boolean).join("\n");
}

/**
 * Parse the JSON envelope returned by the LLM. Gracefully recovers
 * common shapes (top-level array, `prompts` field, etc.) and discards
 * entries that don't match the expected schema.
 */
export function parseLlmResponse(raw: string, language: SupportedLanguage): SuggestedPrompt[] {
	const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
	let parsed: unknown;
	try {
		parsed = JSON.parse(cleaned);
	} catch {
		return [];
	}
	const candidates = (() => {
		if (Array.isArray(parsed)) return parsed;
		if (parsed && typeof parsed === "object" && "prompts" in parsed) {
			const p = (parsed as { prompts: unknown }).prompts;
			if (Array.isArray(p)) return p;
		}
		return [];
	})();

	const out: SuggestedPrompt[] = [];
	for (const c of candidates) {
		if (!c || typeof c !== "object") continue;
		const row = c as Record<string, unknown>;
		if (typeof row.prompt !== "string" || row.prompt.trim().length === 0) continue;
		const category = typeof row.category === "string" ? row.category : "brand";
		let score =
			typeof row.relevance_score === "number"
				? row.relevance_score
				: Number.parseFloat(String(row.relevance_score));
		if (!Number.isFinite(score)) score = 0.5;
		if (score < 0) score = 0;
		if (score > 1) score = 1;
		out.push({ prompt: row.prompt.trim(), category, relevance_score: score, language });
	}
	return out;
}

/**
 * Fall back to the static industry templates, substituting `{{brand_name}}`
 * and `{{domain}}` where possible. Used when the LLM is unavailable or returns
 * an unusable response.
 */
export function renderFallbackTemplates(input: GenerateSuggestedPromptsInput): SuggestedPrompt[] {
	const templates = getIndustryTemplates(input.industry, input.language);
	const vars = {
		brand_name: input.brandName,
		domain: input.domain ?? input.brandName,
		category: input.industry,
		competitors: "anderen Anbietern",
		product_category: input.existingKeywords?.[0] ?? "Produkte",
		brand_industry: input.industry,
		service_category: input.existingKeywords?.[0] ?? "Marketing",
		integration_target: input.existingKeywords?.[0] ?? "Slack",
	};
	return templates.map((t) => ({
		prompt: renderTemplate(t.prompt, vars),
		category: t.category,
		relevance_score: t.relevance_score,
		language: input.language,
	}));
}

/**
 * Main entry point (#203). Calls the LLM; falls back to static templates on
 * any failure so the endpoint always returns something usable.
 */
export async function generateSuggestedPrompts(
	input: GenerateSuggestedPromptsInput,
	llm?: PromptLlmClient,
): Promise<SuggestedPrompt[]> {
	const limit = input.limit ?? 10;
	if (!llm) {
		return renderFallbackTemplates(input).slice(0, limit);
	}

	const system = input.language === "de" ? SYSTEM_PROMPT_DE : SYSTEM_PROMPT_EN;
	const user = buildUserPrompt(input);

	let raw: string;
	try {
		raw = await llm.generate(`${system}\n\n${user}`);
	} catch {
		return renderFallbackTemplates(input).slice(0, limit);
	}

	const parsed = parseLlmResponse(raw, input.language);
	if (parsed.length === 0) {
		return renderFallbackTemplates(input).slice(0, limit);
	}
	return parsed.slice(0, limit);
}
