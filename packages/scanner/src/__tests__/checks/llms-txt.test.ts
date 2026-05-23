import type { CheckContext } from "@beacon/shared";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

// Import directly — no fetchUrl mock needed
const { default: llmsTxtCheck } = await import("../../checks/llms-txt.js");

function makeContext(overrides: Partial<CheckContext> = {}): CheckContext {
	const html = overrides.html ?? "<html><body>Hello</body></html>";
	return {
		inputUrl: "https://example.com",
		finalUrl: "https://example.com",
		html,
		parsedHtml: parse(html),
		responseTime: 100,
		statusCode: 200,
		redirects: [],
		subResources: {},
		...overrides,
	};
}

// ── Fixtures ─────────────────────────────────────────────────

const EXCELLENT_LLMS_TXT = `# Acme Corporation

> Acme Corporation ist ein fuehrender Anbieter von Cloud-Loesungen für mittelständische Unternehmen in der DACH-Region.

Wir bieten Produkte in den Bereichen Cloud-Infrastruktur, DevOps-Automatisierung und Managed Kubernetes.

## Produkte

- [Cloud Platform](https://acme.com/docs/cloud.md): Unsere zentrale Cloud-Infrastruktur-Plattform
- [DevOps Suite](https://acme.com/docs/devops.md): CI/CD Pipelines und Automatisierung
- [Kubernetes Service](https://acme.com/docs/k8s.md): Managed Kubernetes für Enterprise

## API Dokumentation

- [REST API](https://acme.com/docs/api.md): Vollständige API-Referenz
- [SDKs](https://acme.com/docs/sdks.md): Client-Bibliotheken für alle gaengigen Sprachen

## Optional

- [Changelog](https://acme.com/changelog.md)
- [Support](https://acme.com/support.md)
`;

const MINIMAL_LLMS_TXT = `# Acme Corp
`;

const NO_LINKS_LLMS_TXT = `# Acme Corp

> Wir machen Software.

## Produkte

Keine Links hier.
`;

const HTML_RESPONSE = `<!DOCTYPE html>
<html><head><title>404</title></head>
<body><h1>Not Found</h1></body></html>`;

// ── Tests ────────────────────────────────────────────────────

describe("llms-txt check", () => {
	describe("metadata", () => {
		it("has correct id, category, and severity", () => {
			expect(llmsTxtCheck.id).toBe("llms-txt");
			expect(llmsTxtCheck.category).toBe("readability");
			expect(llmsTxtCheck.severity).toBe("critical");
		});
	});

	describe("file not found", () => {
		it("returns fail with score 0 when neither file is prefetched", async () => {
			const result = await llmsTxtCheck.run(makeContext());

			expect(result.status).toBe("fail");
			expect(result.score).toBe(0);
			expect(result.issues.length).toBeGreaterThanOrEqual(1);
			expect(result.issues[0].severity).toBe("critical");
		});
	});

	describe("soft-404 detection", () => {
		it("returns fail when server returns HTML instead of Markdown", async () => {
			const result = await llmsTxtCheck.run(
				makeContext({
					subResources: {
						"/llms.txt": { content: HTML_RESPONSE, statusCode: 200, source: "/llms.txt" },
					},
				}),
			);

			expect(result.status).toBe("fail");
			expect(result.score).toBe(0);
			expect(result.summary).toContain("HTML");
		});
	});

	describe("empty file", () => {
		it("returns fail with low score for empty file", async () => {
			const result = await llmsTxtCheck.run(
				makeContext({
					subResources: {
						"/llms.txt": { content: "", statusCode: 200, source: "/llms.txt" },
					},
				}),
			);

			expect(result.status).toBe("fail");
			expect(result.score).toBe(15); // only "exists" points
			expect(result.issues.some((i) => i.message.includes("leer"))).toBe(true);
		});

		it("returns fail for whitespace-only file", async () => {
			const result = await llmsTxtCheck.run(
				makeContext({
					subResources: {
						"/llms.txt": { content: "   \n  \n  ", statusCode: 200, source: "/llms.txt" },
					},
				}),
			);

			expect(result.status).toBe("fail");
			expect(result.score).toBe(15);
		});
	});

	describe("minimal file", () => {
		it("returns warn for file with only H1", async () => {
			const result = await llmsTxtCheck.run(
				makeContext({
					subResources: {
						"/llms.txt": { content: MINIMAL_LLMS_TXT, statusCode: 200, source: "/llms.txt" },
					},
				}),
			);

			expect(result.status).toBe("warn");
			expect(result.score).toBe(45); // exists(15) + h1(25) + noHtml(5)
		});
	});

	describe("partial file", () => {
		it("returns warn for file with H2 sections but no links", async () => {
			const result = await llmsTxtCheck.run(
				makeContext({
					subResources: {
						"/llms.txt": { content: NO_LINKS_LLMS_TXT, statusCode: 200, source: "/llms.txt" },
					},
				}),
			);

			expect(result.status).toBe("warn");
			// exists(15) + h1(25) + blockquote(10) + h2 partial(10) + noHtml(5) = 65
			expect(result.score).toBe(65);
			expect(result.issues.some((i) => i.message.includes("Links"))).toBe(true);
		});
	});

	describe("excellent file", () => {
		it("returns pass with high score for well-structured file", async () => {
			const result = await llmsTxtCheck.run(
				makeContext({
					subResources: {
						"/llms.txt": { content: EXCELLENT_LLMS_TXT, statusCode: 200, source: "/llms.txt" },
					},
				}),
			);

			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(80);
			expect(result.issues).toHaveLength(0);
		});

		it("includes details with parsed metadata", async () => {
			const result = await llmsTxtCheck.run(
				makeContext({
					subResources: {
						"/llms.txt": { content: EXCELLENT_LLMS_TXT, statusCode: 200, source: "/llms.txt" },
					},
				}),
			);

			expect(result.details).toBeDefined();
			expect(result.details?.h1Count).toBe(1);
			expect(result.details?.h2Count).toBe(3);
			expect(result.details?.linkCount as number).toBeGreaterThanOrEqual(5);
			expect(result.details?.hasBlockquote).toBe(true);
		});
	});

	describe("H1 duplicates", () => {
		it("gives partial score for multiple H1 headers", async () => {
			const content =
				"# First Heading\n\n# Second Heading\n\n## Section\n- [Link](https://example.com): Description\n";
			const result = await llmsTxtCheck.run(
				makeContext({
					subResources: {
						"/llms.txt": { content, statusCode: 200, source: "/llms.txt" },
					},
				}),
			);

			expect(result.issues.some((i) => i.message.includes("Haupttitel"))).toBe(true);
			// Should get partial H1 credit (12) not full (25)
			expect(result.score).toBeLessThan(80);
		});
	});

	describe("HTML tags in Markdown", () => {
		it("deducts points for HTML tags", async () => {
			const content =
				"# My Company\n\n> Great company\n\n<div>Some HTML</div>\n\n## Links\n- [Docs](https://example.com/docs.md): API docs\n";
			const result = await llmsTxtCheck.run(
				makeContext({
					subResources: {
						"/llms.txt": { content, statusCode: 200, source: "/llms.txt" },
					},
				}),
			);

			expect(result.issues.some((i) => i.message.includes("HTML-Code"))).toBe(true);
		});
	});

	describe("link descriptions", () => {
		it("gives full link score when most links have descriptions", async () => {
			const content =
				"# Company\n\n> Summary text here\n\n## Docs\n- [API](https://example.com/api.md): Full reference\n- [Guide](https://example.com/guide.md): Getting started\n- [FAQ](https://example.com/faq.md): Common questions\n";
			const result = await llmsTxtCheck.run(
				makeContext({
					subResources: {
						"/llms.txt": { content, statusCode: 200, source: "/llms.txt" },
					},
				}),
			);

			expect(result.score).toBeGreaterThanOrEqual(80);
		});

		it("gives partial link score when few links have descriptions", async () => {
			const content =
				"# Company\n\n> Summary text here\n\n## Docs\n- [API](https://example.com/api.md)\n- [Guide](https://example.com/guide.md)\n- [FAQ](https://example.com/faq.md): Questions\n";
			const result = await llmsTxtCheck.run(
				makeContext({
					subResources: {
						"/llms.txt": { content, statusCode: 200, source: "/llms.txt" },
					},
				}),
			);

			expect(result.issues.some((i) => i.message.includes("Beschreibung"))).toBe(true);
		});
	});

	describe("fallback to /llms-full.txt", () => {
		it("uses /llms-full.txt when /llms.txt is not prefetched", async () => {
			const result = await llmsTxtCheck.run(
				makeContext({
					subResources: {
						"/llms-full.txt": {
							content: EXCELLENT_LLMS_TXT,
							statusCode: 200,
							source: "/llms-full.txt",
						},
					},
				}),
			);

			expect(result.score).toBeGreaterThan(0);
			expect(result.issues.some((i) => i.message.includes("/llms-full.txt"))).toBe(true);
			expect(result.details?.source).toBe("/llms-full.txt");
		});
	});
});
