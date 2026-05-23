/**
 * Seeds the LANGUAGE_PACK into the `locales` and `prompt_templates` tables.
 * Idempotent: re-running updates display_name/region_context and prompt
 * content for each locale in the pack.
 *
 * Invocation: `pnpm --filter @beacon/ai db:seed-locales-pack`
 */
import { db, localeQueries } from "@beacon/db";
import { LANGUAGE_PACK } from "../prompts/locales/index.js";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is required");
}

let upsertedLocales = 0;
let upsertedTemplates = 0;

for (const pack of LANGUAGE_PACK) {
	const locale = await localeQueries.upsertLocale(db, {
		countryCode: pack.countryCode,
		languageCode: pack.languageCode,
		displayName: pack.displayName,
		isActive: true,
		regionContext: pack.regionContext,
	});
	upsertedLocales += 1;

	for (const [key, content] of Object.entries(pack.templates)) {
		await localeQueries.upsertTemplate(db, {
			localeId: locale.id,
			key,
			content,
			category: "scan",
			variables: [
				"display_name",
				"brand_name",
				"country",
				"language",
				"ai_assistants",
				"search_engines",
				"competitors",
			],
			isActive: true,
		});
		upsertedTemplates += 1;
	}
}

console.log(`Seeded ${upsertedLocales} locales and ${upsertedTemplates} prompt templates.`);
process.exit(0);
