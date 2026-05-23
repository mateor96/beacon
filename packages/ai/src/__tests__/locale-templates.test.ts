import { describe, expect, it } from "vitest";
import {
	UnresolvedPlaceholdersError,
	buildLocaleVariables,
	findUnresolvedPlaceholders,
	renderAndValidate,
	renderTemplate,
} from "../prompts/locale-templates.js";

describe("renderTemplate", () => {
	it("substitutes single-token placeholders", () => {
		expect(renderTemplate("Hello {{name}}", { name: "Mateo" })).toBe("Hello Mateo");
	});

	it("substitutes multiple placeholders", () => {
		expect(renderTemplate("{{language}} ({{country}})", { language: "de", country: "DE" })).toBe(
			"de (DE)",
		);
	});

	it("ignores whitespace inside braces", () => {
		expect(renderTemplate("X={{ name }}", { name: "y" })).toBe("X=y");
	});

	it("leaves placeholders intact when value is missing", () => {
		expect(renderTemplate("Hello {{name}}", {})).toBe("Hello {{name}}");
	});

	it("converts numbers, booleans to strings", () => {
		expect(renderTemplate("a={{n}} b={{b}}", { n: 42, b: true })).toBe("a=42 b=true");
	});

	it("treats null/undefined as missing", () => {
		expect(renderTemplate("a={{n}}", { n: null })).toBe("a={{n}}");
	});
});

describe("findUnresolvedPlaceholders", () => {
	it("returns empty when all placeholders are resolved", () => {
		expect(findUnresolvedPlaceholders("Hello world")).toEqual([]);
	});

	it("returns unique placeholder names", () => {
		expect(findUnresolvedPlaceholders("{{a}} and {{b}} and {{a}}")).toEqual(["a", "b"]);
	});
});

describe("renderAndValidate", () => {
	it("returns rendered text when fully resolved", () => {
		expect(renderAndValidate("Hi {{name}}", { name: "M" }, "test")).toBe("Hi M");
	});

	it("throws UnresolvedPlaceholdersError when placeholders remain", () => {
		expect(() => renderAndValidate("Hi {{name}}", {}, "test")).toThrow(UnresolvedPlaceholdersError);
	});

	it("error includes the missing placeholder names and template key", () => {
		try {
			renderAndValidate("{{a}} {{b}}", { a: "1" }, "my-template");
			expect.fail("should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(UnresolvedPlaceholdersError);
			const e = err as UnresolvedPlaceholdersError;
			expect(e.placeholders).toEqual(["b"]);
			expect(e.templateKey).toBe("my-template");
		}
	});
});

describe("buildLocaleVariables", () => {
	it("flattens basic locale fields", () => {
		const vars = buildLocaleVariables({
			countryCode: "DE",
			languageCode: "de",
			displayName: "Deutsch (Deutschland)",
			regionContext: null,
		});
		expect(vars).toEqual({ country: "DE", language: "de", display_name: "Deutsch (Deutschland)" });
	});

	it("merges scalar regionContext fields", () => {
		const vars = buildLocaleVariables({
			countryCode: "US",
			languageCode: "en",
			displayName: "English (US)",
			regionContext: { search_engine: "google.com", popularity: 1 },
		});
		expect(vars.search_engine).toBe("google.com");
		expect(vars.popularity).toBe(1);
	});

	it("joins string arrays in regionContext with commas", () => {
		const vars = buildLocaleVariables({
			countryCode: "DE",
			languageCode: "de",
			displayName: "Deutsch",
			regionContext: { local_ai_assistants: ["Aleph Alpha", "DeepL Write"] },
		});
		expect(vars.local_ai_assistants).toBe("Aleph Alpha, DeepL Write");
	});

	it("ignores nested objects", () => {
		const vars = buildLocaleVariables({
			countryCode: "DE",
			languageCode: "de",
			displayName: "Deutsch",
			regionContext: { nested: { foo: "bar" } },
		});
		expect("nested" in vars).toBe(false);
	});
});
