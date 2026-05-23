/**
 * Static language-pack definition. Shipped in source control and seeded into
 * the `locales` + `prompt_templates` tables via `pnpm db:seed-locales-pack`.
 *
 * Keep this minimal — only fields the renderer / seed script consume.
 */
export interface LocalePack {
	countryCode: string; // ISO 3166-1 alpha-2 (uppercase)
	languageCode: string; // ISO 639-1 (lowercase)
	displayName: string;
	regionContext: {
		ai_assistants: string[];
		search_engines: string[];
		market_notes?: string;
	};
	templates: {
		readiness_check: string;
		competitor_analysis: string;
	};
}
