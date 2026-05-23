import { describe, expect, it } from "vitest";
import { findUnresolvedPlaceholders } from "../prompts/locale-templates.js";
import { LANGUAGE_PACK } from "../prompts/locales/index.js";

describe("LANGUAGE_PACK", () => {
	it("ships at least 10 locales", () => {
		expect(LANGUAGE_PACK.length).toBeGreaterThanOrEqual(10);
	});

	it("covers the languages required by issue #206", () => {
		const langs = new Set(LANGUAGE_PACK.map((p) => p.languageCode));
		for (const required of ["de", "en", "fr", "it", "es", "pt", "nl", "pl", "cs"]) {
			expect(langs).toContain(required);
		}
	});

	it("each pack has the two required template keys", () => {
		for (const pack of LANGUAGE_PACK) {
			expect(pack.templates.readiness_check.length).toBeGreaterThan(0);
			expect(pack.templates.competitor_analysis.length).toBeGreaterThan(0);
		}
	});

	it("each pack provides ai_assistants and search_engines context", () => {
		for (const pack of LANGUAGE_PACK) {
			expect(pack.regionContext.ai_assistants.length).toBeGreaterThan(0);
			expect(pack.regionContext.search_engines.length).toBeGreaterThan(0);
		}
	});

	it("templates only reference declared placeholder names", () => {
		const declared = new Set([
			"display_name",
			"brand_name",
			"country",
			"language",
			"ai_assistants",
			"search_engines",
			"competitors",
		]);
		for (const pack of LANGUAGE_PACK) {
			for (const [key, content] of Object.entries(pack.templates)) {
				const placeholders = findUnresolvedPlaceholders(content);
				for (const name of placeholders) {
					expect(
						declared.has(name),
						`Template "${pack.countryCode}-${pack.languageCode}/${key}" references undeclared placeholder {{${name}}}`,
					).toBe(true);
				}
			}
		}
	});

	it("country+language pairs are unique", () => {
		const seen = new Set<string>();
		for (const pack of LANGUAGE_PACK) {
			const key = `${pack.countryCode}-${pack.languageCode}`;
			expect(seen.has(key), `duplicate locale ${key}`).toBe(false);
			seen.add(key);
		}
	});

	it("country codes are uppercase 2-letter ISO 3166-1", () => {
		for (const pack of LANGUAGE_PACK) {
			expect(pack.countryCode).toMatch(/^[A-Z]{2}$/);
		}
	});

	it("language codes are lowercase 2-letter ISO 639-1", () => {
		for (const pack of LANGUAGE_PACK) {
			expect(pack.languageCode).toMatch(/^[a-z]{2}$/);
		}
	});
});
