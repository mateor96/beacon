import type { CheckContext } from "@beacon/shared";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

// No fetchUrl mock needed — this check reads from ctx.parsedHtml directly
const { default: schemaOrgCheck } = await import("../../checks/schema-org.js");

// ── Helpers ─────────────────────────────────────────────────

function makeContext(jsonLdBlocks: string[] = [], extraHtml = ""): CheckContext {
	const scripts = jsonLdBlocks
		.map((b) => `<script type="application/ld+json">${b}</script>`)
		.join("\n");
	const html = `<html><head>${scripts}</head><body><h1>Test</h1>${extraHtml}</body></html>`;
	return {
		inputUrl: "https://example.com",
		finalUrl: "https://example.com",
		html,
		parsedHtml: parse(html),
		responseTime: 100,
		statusCode: 200,
		redirects: [],
		subResources: {},
	};
}

// ── Fixtures ────────────────────────────────────────────────

const BASIC_ORG =
	'{"@context":"https://schema.org","@type":"Organization","name":"Acme Corp","url":"https://acme.com"}';

const ORG_MISSING_URL =
	'{"@context":"https://schema.org","@type":"Organization","name":"Acme Corp"}';

const RICH_PAGE_ORG =
	'{"@context":"https://schema.org","@type":"Organization","name":"Acme Corp","url":"https://acme.com","logo":"https://acme.com/logo.png","description":"Leading provider"}';
const RICH_PAGE_WEBSITE =
	'{"@context":"https://schema.org","@type":"WebSite","name":"Acme Corp","url":"https://acme.com"}';
const RICH_PAGE_BREADCRUMB =
	'{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://acme.com"}]}';

const ARTICLE =
	'{"@context":"https://schema.org","@type":"Article","headline":"How to Optimize for AI","author":{"@type":"Person","name":"Max Mustermann"},"datePublished":"2025-01-15"}';

const PRODUCT =
	'{"@context":"https://schema.org","@type":"Product","name":"Widget Pro","description":"The best widget","offers":{"@type":"Offer","price":"49.99","priceCurrency":"EUR"}}';

const FAQ_PAGE =
	'{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Was ist Beacon?","acceptedAnswer":{"@type":"Answer","text":"Ein AI Readiness Tool."}}]}';

const GRAPH_WRAPPER =
	'{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Acme Corp","url":"https://acme.com"},{"@type":"WebSite","name":"Acme Corp","url":"https://acme.com"}]}';

const ARRAY_FORMAT =
	'[{"@context":"https://schema.org","@type":"Organization","name":"Acme Corp","url":"https://acme.com"},{"@context":"https://schema.org","@type":"WebSite","name":"Acme Corp","url":"https://acme.com"}]';

const TYPE_ARRAY =
	'{"@context":"https://schema.org","@type":["Organization","LocalBusiness"],"name":"Acme Corp","url":"https://acme.com","address":"Berlin"}';

const UNKNOWN_TYPE = '{"@context":"https://schema.org","@type":"Recipe","name":"Chocolate Cake"}';

const NO_CONTEXT = '{"@type":"Organization","name":"Acme Corp","url":"https://acme.com"}';

const INVALID_JSON = "{ this is not valid json }";

// ── Tests ───────────────────────────────────────────────────

describe("schema-org check", () => {
	describe("metadata", () => {
		it("has correct id, category, and severity", () => {
			expect(schemaOrgCheck.id).toBe("schema-org");
			expect(schemaOrgCheck.category).toBe("readability");
			expect(schemaOrgCheck.severity).toBe("important");
		});
	});

	describe("no JSON-LD", () => {
		it("returns fail with score 0 when no script tags exist", async () => {
			const result = await schemaOrgCheck.run(makeContext());

			expect(result.status).toBe("fail");
			expect(result.score).toBe(0);
			expect(result.issues).toHaveLength(1);
			expect(result.issues[0].message).toContain("Keine Strukturierten Daten gefunden");
		});
	});

	describe("invalid JSON", () => {
		it("returns fail with score 10 for malformed JSON", async () => {
			const result = await schemaOrgCheck.run(makeContext([INVALID_JSON]));

			expect(result.status).toBe("fail");
			expect(result.score).toBe(10);
			expect(result.issues.some((i) => i.message.includes("ungültiges Datenformat"))).toBe(true);
		});
	});

	describe("all blocks invalid", () => {
		it("returns fail with score 10 for multiple malformed blocks", async () => {
			const result = await schemaOrgCheck.run(makeContext([INVALID_JSON, "{ also broken }"]));

			expect(result.status).toBe("fail");
			expect(result.score).toBe(10);
			expect(result.issues.some((i) => i.message.includes("Alle Strukturierte-Daten-Blöcke"))).toBe(
				true,
			);
		});
	});

	describe("empty object", () => {
		it("returns fail for empty {} block", async () => {
			const result = await schemaOrgCheck.run(makeContext(["{}"]));

			expect(result.status).toBe("fail");
			expect(result.score).toBe(25); // exists(10) + validJson(15)
			expect(result.issues.some((i) => i.message.includes("leer"))).toBe(true);
			expect(result.issues.some((i) => i.message.includes("Inhaltstyp-Angabe (@type)"))).toBe(true);
		});
	});

	describe("basic Organization", () => {
		it("returns pass with score 90 for complete Organization", async () => {
			const result = await schemaOrgCheck.run(makeContext([BASIC_ORG]));

			expect(result.status).toBe("pass");
			expect(result.score).toBe(90);
			expect(result.issues.every((i) => i.severity !== "critical")).toBe(true);
		});
	});

	describe("Organization missing url", () => {
		it("returns warn with score 77 for incomplete Organization", async () => {
			const result = await schemaOrgCheck.run(makeContext([ORG_MISSING_URL]));

			expect(result.status).toBe("warn");
			expect(result.score).toBe(77);
			expect(result.issues.some((i) => i.message.includes("fehlend: url"))).toBe(true);
		});
	});

	describe("rich multi-type page", () => {
		it("returns pass with score 100 for Org+WebSite+BreadcrumbList", async () => {
			const result = await schemaOrgCheck.run(
				makeContext([RICH_PAGE_ORG, RICH_PAGE_WEBSITE, RICH_PAGE_BREADCRUMB]),
			);

			expect(result.status).toBe("pass");
			expect(result.score).toBe(100);
			expect(result.details).toBeDefined();
			expect((result.details as Record<string, unknown>).aiRelevantTypes).toHaveLength(3);
		});
	});

	describe("Article", () => {
		it("returns pass for Article with headline", async () => {
			const result = await schemaOrgCheck.run(makeContext([ARTICLE]));

			expect(result.score).toBeGreaterThanOrEqual(70);
			expect((result.details as Record<string, unknown>).typesFound).toContain("Article");
		});
	});

	describe("Product", () => {
		it("returns pass for Product with name", async () => {
			const result = await schemaOrgCheck.run(makeContext([PRODUCT]));

			expect(result.score).toBeGreaterThanOrEqual(70);
			expect((result.details as Record<string, unknown>).typesFound).toContain("Product");
		});
	});

	describe("FAQPage", () => {
		it("returns pass for FAQPage with mainEntity", async () => {
			const result = await schemaOrgCheck.run(makeContext([FAQ_PAGE]));

			expect(result.score).toBeGreaterThanOrEqual(70);
			expect((result.details as Record<string, unknown>).typesFound).toContain("FAQPage");
		});
	});

	describe("@graph format", () => {
		it("correctly flattens @graph array", async () => {
			const result = await schemaOrgCheck.run(makeContext([GRAPH_WRAPPER]));

			const details = result.details as Record<string, unknown>;
			expect(details.aiRelevantTypes).toContain("Organization");
			expect(details.aiRelevantTypes).toContain("WebSite");
			// Should NOT have missing @context issue (inherited from parent)
			expect(result.issues.some((i) => i.message.includes("Schema-Referenz (@context)"))).toBe(
				false,
			);
		});
	});

	describe("array format", () => {
		it("correctly parses top-level JSON array", async () => {
			const result = await schemaOrgCheck.run(makeContext([ARRAY_FORMAT]));

			const details = result.details as Record<string, unknown>;
			expect((details.typesFound as string[]).length).toBeGreaterThanOrEqual(2);
			expect(details.aiRelevantTypes).toContain("Organization");
			expect(details.aiRelevantTypes).toContain("WebSite");
		});
	});

	describe("multiple script tags", () => {
		it("parses both scripts and awards multipleSchemas credit", async () => {
			const result = await schemaOrgCheck.run(makeContext([BASIC_ORG, RICH_PAGE_WEBSITE]));

			const details = result.details as Record<string, unknown>;
			expect(details.jsonLdBlockCount).toBe(2);
			expect(details.validBlockCount).toBe(2);
			// Should get multi credit (2 types = 5 pts)
			expect(result.score).toBeGreaterThanOrEqual(85);
		});
	});

	describe("@type as array", () => {
		it("correctly resolves array @type", async () => {
			const result = await schemaOrgCheck.run(makeContext([TYPE_ARRAY]));

			const details = result.details as Record<string, unknown>;
			expect(details.typesFound).toContain("Organization");
			expect(details.typesFound).toContain("LocalBusiness");
			expect(result.status).toBe("pass");
		});
	});

	describe("unknown @type", () => {
		it("returns warn with score 40 for unrecognized type", async () => {
			const result = await schemaOrgCheck.run(makeContext([UNKNOWN_TYPE]));

			expect(result.status).toBe("warn");
			expect(result.score).toBe(40);
			expect(result.issues.some((i) => i.message.includes("Keine KI-relevanten"))).toBe(true);
		});
	});

	describe("missing @context", () => {
		it("returns nice-to-have issue and noErrors=0", async () => {
			const result = await schemaOrgCheck.run(makeContext([NO_CONTEXT]));

			expect(result.issues.some((i) => i.message.includes("Schema-Referenz (@context)"))).toBe(
				true,
			);
			expect(result.score).toBe(85); // 90 - 5 (noErrors)
		});
	});

	describe("mixed valid/invalid blocks", () => {
		it("handles mix of valid and invalid JSON", async () => {
			const result = await schemaOrgCheck.run(makeContext([BASIC_ORG, INVALID_JSON]));

			// validJson should be partial (7 instead of 15)
			expect(result.issues.some((i) => i.message.includes("Blöcken enthalten Fehler"))).toBe(true);
			// Score: exists(10) + validJson(7) + hasType(10) + relevant(25) + required(25) + multi(0) + noErrors(5) = 82
			expect(result.score).toBe(82);
			expect(result.status).toBe("pass");
		});
	});
});
