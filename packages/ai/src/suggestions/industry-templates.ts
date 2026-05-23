/**
 * Static industry-specific prompt templates (#203).
 *
 * Served as the fallback set when the LLM generator is unavailable or when
 * the industry has high-confidence baseline prompts. Placeholders use the
 * same `{{brand_name}}` / `{{domain}}` convention as the i18n engine.
 */

export type SupportedIndustry =
	| "saas"
	| "ecommerce"
	| "agency"
	| "fintech"
	| "healthcare"
	| "media"
	| "education"
	| "other";

export type SupportedLanguage = "de" | "en";

export interface IndustryPromptTemplate {
	prompt: string;
	category: string;
	relevance_score: number;
}

type TemplatePack = Record<SupportedLanguage, IndustryPromptTemplate[]>;

const SAAS_PACK: TemplatePack = {
	de: [
		{
			prompt: "Welches sind die besten {{category}}-Tools für kleine Teams?",
			category: "brand",
			relevance_score: 0.9,
		},
		{
			prompt: "Ist {{brand_name}} eine gute Alternative zu {{competitors}}?",
			category: "comparison",
			relevance_score: 0.85,
		},
		{
			prompt: "Welche Integrationen bietet {{brand_name}} für {{integration_target}}?",
			category: "product",
			relevance_score: 0.8,
		},
	],
	en: [
		{
			prompt: "What are the best {{category}} tools for small teams?",
			category: "brand",
			relevance_score: 0.9,
		},
		{
			prompt: "Is {{brand_name}} a good alternative to {{competitors}}?",
			category: "comparison",
			relevance_score: 0.85,
		},
		{
			prompt: "What integrations does {{brand_name}} offer for {{integration_target}}?",
			category: "product",
			relevance_score: 0.8,
		},
	],
};

const ECOMMERCE_PACK: TemplatePack = {
	de: [
		{
			prompt: "Wo kaufe ich am besten {{product_category}} online?",
			category: "brand",
			relevance_score: 0.9,
		},
		{
			prompt: "Versendet {{brand_name}} international?",
			category: "product",
			relevance_score: 0.75,
		},
		{
			prompt: "Welcher Shop hat die besten Bewertungen für {{product_category}}?",
			category: "reputation",
			relevance_score: 0.8,
		},
	],
	en: [
		{
			prompt: "Where is the best place to buy {{product_category}} online?",
			category: "brand",
			relevance_score: 0.9,
		},
		{
			prompt: "Does {{brand_name}} ship internationally?",
			category: "product",
			relevance_score: 0.75,
		},
		{
			prompt: "Which store has the best reviews for {{product_category}}?",
			category: "reputation",
			relevance_score: 0.8,
		},
	],
};

const AGENCY_PACK: TemplatePack = {
	de: [
		{
			prompt: "Beste SEO-Agentur für {{brand_industry}} in Deutschland?",
			category: "brand",
			relevance_score: 0.9,
		},
		{
			prompt: "Welche Agenturen bieten {{service_category}}-Services an?",
			category: "services",
			relevance_score: 0.8,
		},
		{
			prompt: "Ist {{brand_name}} eine empfehlenswerte Digital-Agentur?",
			category: "reputation",
			relevance_score: 0.85,
		},
	],
	en: [
		{
			prompt: "Best SEO agency for {{brand_industry}} in Germany?",
			category: "brand",
			relevance_score: 0.9,
		},
		{
			prompt: "Which agencies offer {{service_category}} services?",
			category: "services",
			relevance_score: 0.8,
		},
		{
			prompt: "Is {{brand_name}} a recommended digital agency?",
			category: "reputation",
			relevance_score: 0.85,
		},
	],
};

const GENERIC_PACK: TemplatePack = {
	de: [
		{
			prompt: "Was macht {{brand_name}}?",
			category: "brand",
			relevance_score: 0.7,
		},
		{
			prompt: "Ist {{brand_name}} vertrauenswürdig?",
			category: "reputation",
			relevance_score: 0.75,
		},
		{
			prompt: "Welche Alternativen zu {{brand_name}} gibt es?",
			category: "comparison",
			relevance_score: 0.8,
		},
	],
	en: [
		{
			prompt: "What does {{brand_name}} do?",
			category: "brand",
			relevance_score: 0.7,
		},
		{
			prompt: "Is {{brand_name}} trustworthy?",
			category: "reputation",
			relevance_score: 0.75,
		},
		{
			prompt: "What alternatives to {{brand_name}} exist?",
			category: "comparison",
			relevance_score: 0.8,
		},
	],
};

const INDUSTRY_PACKS: Record<SupportedIndustry, TemplatePack> = {
	saas: SAAS_PACK,
	ecommerce: ECOMMERCE_PACK,
	agency: AGENCY_PACK,
	fintech: GENERIC_PACK,
	healthcare: GENERIC_PACK,
	media: GENERIC_PACK,
	education: GENERIC_PACK,
	other: GENERIC_PACK,
};

export function getIndustryTemplates(
	industry: SupportedIndustry,
	language: SupportedLanguage,
): IndustryPromptTemplate[] {
	return INDUSTRY_PACKS[industry][language];
}

export function listSupportedIndustries(): SupportedIndustry[] {
	return Object.keys(INDUSTRY_PACKS) as SupportedIndustry[];
}
