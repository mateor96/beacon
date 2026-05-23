import { describe, expect, it } from "vitest";
import {
	buildLocaleVariables,
	findUnresolvedPlaceholders,
	renderTemplate,
} from "../prompts/locale-templates.js";
import { LANGUAGE_PACK } from "../prompts/locales/index.js";

/**
 * #267 acceptance: every LANGUAGE_PACK template must render with no
 * unresolved placeholders when fed the standard variable bag built from
 * the locale row + the runtime-supplied variables (brand_name, competitors).
 */

const RUNTIME_VARS = {
	brand_name: "Beacon",
	competitors: "Acme, Globex, Initech",
};

describe("LANGUAGE_PACK rendering (issue #267)", () => {
	for (const pack of LANGUAGE_PACK) {
		const tag = `${pack.countryCode}-${pack.languageCode}`;
		describe(`${tag} (${pack.displayName})`, () => {
			const localeVars = buildLocaleVariables({
				countryCode: pack.countryCode,
				languageCode: pack.languageCode,
				displayName: pack.displayName,
				regionContext: pack.regionContext,
			});
			const allVars = { ...localeVars, ...RUNTIME_VARS };

			it("readiness_check renders with no unresolved placeholders", () => {
				const rendered = renderTemplate(pack.templates.readiness_check, allVars);
				const remaining = findUnresolvedPlaceholders(rendered);
				expect(remaining, `unresolved: ${remaining.join(", ")}`).toEqual([]);
			});

			it("competitor_analysis renders with no unresolved placeholders", () => {
				const rendered = renderTemplate(pack.templates.competitor_analysis, allVars);
				const remaining = findUnresolvedPlaceholders(rendered);
				expect(remaining, `unresolved: ${remaining.join(", ")}`).toEqual([]);
			});

			it("regionContext.ai_assistants is exposed as a comma-joined string", () => {
				expect(typeof localeVars.ai_assistants).toBe("string");
				expect(localeVars.ai_assistants).toContain(",");
			});

			it("country code is exposed", () => {
				expect(localeVars.country).toBe(pack.countryCode);
			});

			it("language code is exposed", () => {
				expect(localeVars.language).toBe(pack.languageCode);
			});
		});
	}
});

describe("locale ISO code validation (issue #267)", () => {
	const COUNTRY_RE = /^[A-Z]{2}$/;
	const LANGUAGE_RE = /^[a-z]{2}$/;

	it("rejects lowercase country codes", () => {
		expect(COUNTRY_RE.test("de")).toBe(false);
	});
	it("rejects 3-char country codes", () => {
		expect(COUNTRY_RE.test("DEU")).toBe(false);
	});
	it("accepts standard 2-char uppercase country codes", () => {
		expect(COUNTRY_RE.test("DE")).toBe(true);
		expect(COUNTRY_RE.test("US")).toBe(true);
		expect(COUNTRY_RE.test("JP")).toBe(true);
	});
	it("rejects uppercase language codes", () => {
		expect(LANGUAGE_RE.test("DE")).toBe(false);
	});
	it("accepts standard 2-char lowercase language codes", () => {
		expect(LANGUAGE_RE.test("de")).toBe(true);
		expect(LANGUAGE_RE.test("ja")).toBe(true);
	});
});
