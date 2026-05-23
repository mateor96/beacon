import { describe, expect, it } from "vitest";
import { parseFeatureOverrides } from "../stripe/metadata.js";

describe("parseFeatureOverrides", () => {
	it("returns null for null input", () => {
		expect(parseFeatureOverrides(null)).toBeNull();
	});

	it("returns null for undefined input", () => {
		expect(parseFeatureOverrides(undefined)).toBeNull();
	});

	it("returns null for empty metadata", () => {
		expect(parseFeatureOverrides({})).toBeNull();
	});

	it("returns null when no feature: prefixed keys", () => {
		expect(parseFeatureOverrides({ plan: "pro", interval: "monthly" })).toBeNull();
	});

	it("parses valid feature:* keys", () => {
		const result = parseFeatureOverrides({
			"feature:webhooks": "true",
			"feature:apiAccess": "false",
		});
		expect(result).toEqual({ webhooks: true, apiAccess: false });
	});

	it("ignores unknown feature keys", () => {
		const result = parseFeatureOverrides({
			"feature:webhooks": "true",
			"feature:unknownThing": "true",
		});
		expect(result).toEqual({ webhooks: true });
	});

	it("ignores keys without feature: prefix", () => {
		const result = parseFeatureOverrides({
			"feature:dashboard": "true",
			plan: "pro",
			interval: "monthly",
		});
		expect(result).toEqual({ dashboard: true });
	});

	it("treats any value except 'true' as false", () => {
		const result = parseFeatureOverrides({
			"feature:dashboard": "yes",
			"feature:webhooks": "1",
		});
		expect(result).toEqual({ dashboard: false, webhooks: false });
	});
});
