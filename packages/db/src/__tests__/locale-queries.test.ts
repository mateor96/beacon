import { describe, expect, it } from "vitest";
import * as localeQueries from "../queries/locales.js";

/**
 * #267 acceptance: the localeQueries module exposes the surface that
 * downstream consumers (web API, scanner worker, dashboard) depend on.
 * Mirrors the export-shape contract test pattern used elsewhere in this
 * package; integration tests against a live DB live in the docker-compose
 * dev environment and run in CI separately.
 */
describe("localeQueries module surface (issue #267)", () => {
	const REQUIRED = [
		// locale CRUD
		"getLocaleById",
		"getLocaleByCode",
		"listActiveLocales",
		"listAllLocales",
		"createLocale",
		"createLocaleIdempotent",
		"upsertLocale",
		"updateLocale",
		"setLocaleActive",
		// domain_locales
		"listLocalesForDomain",
		"getPrimaryLocaleForDomain",
		"attachLocaleToDomain",
		"detachLocaleFromDomain",
		"setPrimaryLocale",
		// prompt_templates
		"listTemplatesByLocale",
		"getTemplate",
		"upsertTemplate",
		"deleteTemplate",
	] as const;

	for (const name of REQUIRED) {
		it(`exports ${name} as a function`, () => {
			expect(typeof (localeQueries as Record<string, unknown>)[name]).toBe("function");
		});
	}

	it("exports no surplus functions (locks API surface)", () => {
		const exported = Object.keys(localeQueries).filter(
			(k) => typeof (localeQueries as Record<string, unknown>)[k] === "function",
		);
		expect(exported.sort()).toEqual([...REQUIRED].sort());
	});
});
