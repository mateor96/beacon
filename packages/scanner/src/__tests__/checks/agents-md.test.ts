import type { CheckContext } from "@beacon/shared";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

// Import directly — no fetchUrl mock needed
const { default: agentsMdCheck } = await import("../../checks/agents-md.js");

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

const EXCELLENT_AGENTS_MD = `# Acme Corporation — Agent Interface

> Diese Datei beschreibt welche KI-Agenten mit unserer Website interagieren können.

## Shopping Assistant Agent

Unser Shopping-Agent hilft Nutzern Produkte zu finden und Bestellungen aufzugeben.

### Capabilities

- Produktsuche nach Kategorie, Preis und Verfügbarkeit
- Warenkorb erstellen und verwalten
- Bestellstatus abfragen
- Retouren einleiten

### Endpoint

POST https://api.acme.com/v1/agent/shopping

### Auth

Bearer Token via OAuth 2.0

## Support Agent

Beantwortet häufige Fragen und leitet komplexe Anfragen weiter.

### Capabilities

- FAQ-Antworten liefern
- Ticket erstellen
- Wissensdatenbank durchsuchen

### Endpoint

POST https://api.acme.com/v1/agent/support

## Kontakt

Bei Fragen zur Agent-Integration: agents@acme.com
Policy: https://acme.com/agent-policy
`;

const GOOD_AGENTS_MD = `# Acme Corp Agents

## Search Agent

Ermöglicht die Produktsuche über KI-Agenten.

### Capabilities

- Volltextsuche
- Filterung nach Kategorie

## Kontakt

info@acme.com
`;

const MINIMAL_AGENTS_MD = `# Acme Corp
`;

const NO_AGENTS_DEFINED = `# My Website

## About

This is a general description of our website with enough content to be meaningful.

## Features

- Feature 1
- Feature 2
- Feature 3
`;

const HTML_RESPONSE = `<!DOCTYPE html>
<html><head><title>404</title></head>
<body><h1>Not Found</h1></body></html>`;

const HTML_IN_MARKDOWN = `# Acme Agents

<div class="agent">

## Bot Agent

### Capabilities

- Search
- Browse
</div>

## Kontakt

agent@acme.com
`;

// ── Tests ────────────────────────────────────────────────────

describe("agents-md check", () => {
	describe("metadata", () => {
		it("has correct id, category, and severity", () => {
			expect(agentsMdCheck.id).toBe("agents-md");
			expect(agentsMdCheck.category).toBe("interactivity");
			expect(agentsMdCheck.severity).toBe("nice-to-have");
		});
	});

	describe("file not found", () => {
		it("returns fail with score 0 when not prefetched", async () => {
			const result = await agentsMdCheck.run(makeContext());

			expect(result.status).toBe("fail");
			expect(result.score).toBe(0);
			expect(result.issues.length).toBeGreaterThanOrEqual(1);
			expect(result.issues[0].severity).toBe("important");
		});
	});

	describe("soft-404 detection", () => {
		it("returns fail when server returns HTML instead of Markdown", async () => {
			const result = await agentsMdCheck.run(
				makeContext({
					subResources: {
						"/.well-known/agents.md": {
							content: HTML_RESPONSE,
							statusCode: 200,
							source: "/.well-known/agents.md",
						},
					},
				}),
			);

			expect(result.status).toBe("fail");
			expect(result.score).toBe(0);
			expect(result.issues[0].message).toContain("HTML");
		});
	});

	describe("empty file", () => {
		it("returns fail with exists-only score for empty file", async () => {
			const result = await agentsMdCheck.run(
				makeContext({
					subResources: {
						"/.well-known/agents.md": {
							content: "",
							statusCode: 200,
							source: "/.well-known/agents.md",
						},
					},
				}),
			);

			expect(result.status).toBe("fail");
			expect(result.score).toBe(15);
			expect(result.issues.some((i) => i.message.includes("leer"))).toBe(true);
		});

		it("returns fail for whitespace-only file", async () => {
			const result = await agentsMdCheck.run(
				makeContext({
					subResources: {
						"/.well-known/agents.md": {
							content: "   \n  \n  ",
							statusCode: 200,
							source: "/.well-known/agents.md",
						},
					},
				}),
			);

			expect(result.status).toBe("fail");
			expect(result.score).toBe(15);
		});
	});

	describe("minimal file", () => {
		it("returns warn for file with only H1", async () => {
			const result = await agentsMdCheck.run(
				makeContext({
					subResources: {
						"/.well-known/agents.md": {
							content: MINIMAL_AGENTS_MD,
							statusCode: 200,
							source: "/.well-known/agents.md",
						},
					},
				}),
			);

			// exists(15) + title(20) + noHtml(5) = 40 → threshold is <40 for fail, so warn
			expect(result.status).toBe("warn");
			expect(result.score).toBe(40);
		});
	});

	describe("no agent keywords in sections", () => {
		it("returns warn with partial agentDefs credit", async () => {
			const result = await agentsMdCheck.run(
				makeContext({
					subResources: {
						"/.well-known/agents.md": {
							content: NO_AGENTS_DEFINED,
							statusCode: 200,
							source: "/.well-known/agents.md",
						},
					},
				}),
			);

			expect(result.status).toBe("warn");
			// exists(15) + title(20) + agentDefs partial(12) + noHtml(5) = 52
			expect(result.score).toBe(52);
			expect(result.issues.some((i) => i.message.includes("Agenten-Beschreibungen"))).toBe(true);
		});
	});

	describe("good file", () => {
		it("returns pass with score >= 80", async () => {
			const result = await agentsMdCheck.run(
				makeContext({
					subResources: {
						"/.well-known/agents.md": {
							content: GOOD_AGENTS_MD,
							statusCode: 200,
							source: "/.well-known/agents.md",
						},
					},
				}),
			);

			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(80);
		});
	});

	describe("excellent file", () => {
		it("returns pass with score 100", async () => {
			const result = await agentsMdCheck.run(
				makeContext({
					subResources: {
						"/.well-known/agents.md": {
							content: EXCELLENT_AGENTS_MD,
							statusCode: 200,
							source: "/.well-known/agents.md",
						},
					},
				}),
			);

			expect(result.status).toBe("pass");
			expect(result.score).toBe(100);
			expect(result.issues).toHaveLength(0);
		});

		it("includes details with parsed metadata", async () => {
			const result = await agentsMdCheck.run(
				makeContext({
					subResources: {
						"/.well-known/agents.md": {
							content: EXCELLENT_AGENTS_MD,
							statusCode: 200,
							source: "/.well-known/agents.md",
						},
					},
				}),
			);

			expect(result.details).toBeDefined();
			expect(result.details?.h1Count).toBe(1);
			expect(result.details?.agentSectionCount).toBeGreaterThanOrEqual(2);
			expect(result.details?.hasCapabilities).toBe(true);
			expect(result.details?.hasContactInfo).toBe(true);
			expect(result.details?.source).toBe("/.well-known/agents.md");
		});
	});

	describe("HTML tags in Markdown", () => {
		it("deducts noHtml points and reports issue", async () => {
			const result = await agentsMdCheck.run(
				makeContext({
					subResources: {
						"/.well-known/agents.md": {
							content: HTML_IN_MARKDOWN,
							statusCode: 200,
							source: "/.well-known/agents.md",
						},
					},
				}),
			);

			expect(result.issues.some((i) => i.message.includes("HTML-Code"))).toBe(true);
			// Should not get noHtml(5) points
			const scoreWithHtml = result.score;
			// Verify it's less than it would be without HTML (would gain 5)
			expect(scoreWithHtml).toBeLessThanOrEqual(95);
		});
	});

	describe("fallback path", () => {
		it("uses /agents.md when primary path is not prefetched", async () => {
			const result = await agentsMdCheck.run(
				makeContext({
					subResources: {
						"/agents.md": {
							content: EXCELLENT_AGENTS_MD,
							statusCode: 200,
							source: "/agents.md",
						},
					},
				}),
			);

			expect(result.score).toBeGreaterThan(0);
			expect(result.issues.some((i) => i.message.includes("/agents.md"))).toBe(true);
			expect(result.details?.source).toBe("/agents.md");
		});
	});

	describe("short content", () => {
		it("reports issue for valid structure but short content", async () => {
			const shortContent = `# Agents

## Bot Agent

### Capabilities

- Search
`;
			const result = await agentsMdCheck.run(
				makeContext({
					subResources: {
						"/.well-known/agents.md": {
							content: shortContent,
							statusCode: 200,
							source: "/.well-known/agents.md",
						},
					},
				}),
			);

			expect(result.issues.some((i) => i.message.includes("kurz"))).toBe(true);
		});
	});
});
