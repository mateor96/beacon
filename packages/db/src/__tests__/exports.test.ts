import { describe, expect, it } from "vitest";

describe("@beacon/db exports", () => {
	it("profileQueries exports exactly the allowed keys", async () => {
		const { profileQueries } = await import("../queries/index.js");

		const ALLOWED_KEYS = ["getById", "create", "ensureProfile", "getBranding", "updateBranding"];

		expect(Object.keys(profileQueries).sort()).toEqual([...ALLOWED_KEYS].sort());

		for (const key of ALLOWED_KEYS) {
			expect(typeof profileQueries[key as keyof typeof profileQueries]).toBe("function");
		}
	});

	it("exports the expected query namespaces", async () => {
		const queries = await import("../queries/index.js");

		const EXPECTED_NAMESPACES = [
			"profileQueries",
			"scanQueries",
			"anonymousScanQueries",
			"monitoringQueries",
			"crawlQueries",
			"benchmarkQueries",
			"alertQueries",
			"cleanupQueries",
			"waitlistQueries",
			"deadLetterJobQueries",
			"emailQueries",
			"publicAuditQueries",
			"aiVisibilityQueries",
			"competitorQueries",
			"fixQueries",
			"roiQueries",
			"citationQueries",
			"competitiveQueries",
			"localeQueries",
			"redditQueries",
			"csvExportQueries",
			"reportShareQueries",
			"webhookQueries",
		];

		expect(Object.keys(queries).sort()).toEqual([...EXPECTED_NAMESPACES].sort());
	});

	it("exports the mergeScanFixes RPC", async () => {
		const rpc = await import("../rpc.js");
		expect(typeof rpc.mergeScanFixes).toBe("function");
	});
});
