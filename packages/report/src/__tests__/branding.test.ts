import { describe, expect, it } from "vitest";
import { DEFAULT_BRANDING, mergeBranding } from "../branding.js";

describe("DEFAULT_BRANDING", () => {
	it("has expected default values", () => {
		expect(DEFAULT_BRANDING.agencyName).toBe("Beacon - Agentic Web Readiness");
		expect(DEFAULT_BRANDING.primaryColor).toBe("#0f172a");
		expect(DEFAULT_BRANDING.accentColor).toBe("#3b82f6");
	});
});

describe("mergeBranding", () => {
	it("returns defaults when called without arguments", () => {
		const result = mergeBranding();
		expect(result).toEqual(DEFAULT_BRANDING);
	});

	it("merges partial overrides with defaults", () => {
		const result = mergeBranding({ primaryColor: "#ff0000" });
		expect(result.primaryColor).toBe("#ff0000");
		expect(result.accentColor).toBe(DEFAULT_BRANDING.accentColor);
		expect(result.agencyName).toBe(DEFAULT_BRANDING.agencyName);
	});

	it("overrides all fields when fully specified", () => {
		const custom = {
			agencyName: "Test Agency",
			primaryColor: "#111",
			accentColor: "#222",
		};
		const result = mergeBranding(custom);
		expect(result).toEqual(custom);
	});
});
