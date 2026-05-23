import type { CheckContext } from "@beacon/shared";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

// Import directly — no fetchUrl mock needed
const { default: robotsTxtCheck } = await import("../../checks/robots-txt.js");

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

// ── Fixtures ────────────────────────────────────────────────

const BASIC = `User-agent: *
Disallow: /admin/
Disallow: /private/

Sitemap: https://example.com/sitemap.xml
`;

const BLANKET_DISALLOW = `User-agent: *
Disallow: /
`;

const AI_BOTS_ALLOWED = `User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
`;

const AI_BOTS_BLOCKED = `User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Claude-Web
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Googlebot
Disallow: /

User-agent: Bingbot
Disallow: /

User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
`;

const MIXED = `User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Allow: /

User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
`;

const HTML_RESPONSE = `<!DOCTYPE html>
<html><head><title>404</title></head>
<body><h1>Not Found</h1></body></html>`;

const MALFORMED = `User-agent: *
Disallow: /admin/
This is a malformed line
Another bad line
Yet another bad one
Allow: /public/
Bad line four
`;

const EMPTY_DISALLOW = `User-agent: GPTBot
Disallow:

User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
`;

// ── Tests ───────────────────────────────────────────────────

describe("robots-txt check", () => {
	describe("metadata", () => {
		it("has correct id, category, and severity", () => {
			expect(robotsTxtCheck.id).toBe("robots-txt");
			expect(robotsTxtCheck.category).toBe("readability");
			expect(robotsTxtCheck.severity).toBe("critical");
		});
	});

	describe("file not found (RFC 9309: missing = allow all)", () => {
		it("returns warn with score 55 when not prefetched", async () => {
			const result = await robotsTxtCheck.run(makeContext());

			expect(result.status).toBe("warn");
			expect(result.score).toBe(55);
			expect(result.issues.length).toBeGreaterThanOrEqual(1);
			expect(result.issues[0].severity).toBe("important");
		});

		it("scores higher than blanket disallow since missing = allow all", async () => {
			const missingResult = await robotsTxtCheck.run(makeContext());
			const blanketResult = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content: BLANKET_DISALLOW, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			expect(missingResult.score).toBeGreaterThan(blanketResult.score);
		});
	});

	describe("soft-404 detection", () => {
		it("returns fail when server returns HTML instead of text", async () => {
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content: HTML_RESPONSE, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			expect(result.status).toBe("fail");
			expect(result.score).toBe(0);
			expect(result.issues[0].message).toContain("HTML");
		});
	});

	describe("empty file", () => {
		it("returns fail with exists points for empty file", async () => {
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content: "", statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			expect(result.status).toBe("fail");
			expect(result.score).toBe(10); // only exists points
			expect(result.issues[0].message).toContain("leer");
		});

		it("returns fail for whitespace-only file", async () => {
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content: "   \n  \n  ", statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			expect(result.status).toBe("fail");
			expect(result.score).toBe(10);
		});
	});

	describe("blanket disallow", () => {
		it("returns fail when * has Disallow: /", async () => {
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content: BLANKET_DISALLOW, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			expect(result.status).toBe("fail");
			// exists(10) + syntax(10) + aiDirectives(0) + primary(0) + secondary(0) + sitemap(0) + noGlobalBlock(0) = 20
			expect(result.score).toBe(20);
			expect(result.issues.some((i) => i.message.includes("Globale Regel"))).toBe(true);
		});
	});

	describe("basic without AI directives", () => {
		it("returns pass for common site with selective disallow and sitemap", async () => {
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content: BASIC, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			// exists(10) + syntax(10) + aiDirectives(0) + primary(30) + secondary(10) + sitemap(10) + noGlobalBlock(15) = 85
			expect(result.score).toBe(85);
			expect(result.status).toBe("pass");
		});
	});

	describe("AI bots allowed", () => {
		it("returns pass with score 100 when all AI bots explicitly allowed", async () => {
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content: AI_BOTS_ALLOWED, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			expect(result.status).toBe("pass");
			expect(result.score).toBe(100);
		});
	});

	describe("AI bots blocked", () => {
		it("returns warn with issues per blocked bot", async () => {
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content: AI_BOTS_BLOCKED, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			// exists(10) + syntax(10) + aiDirectives(15) + primary(0) + secondary(0) + sitemap(10) + noGlobalBlock(15) = 60 → warn
			expect(result.status).toBe("warn");
			expect(result.score).toBe(60);
			expect(result.issues.filter((i) => i.message.includes("blockiert"))).toHaveLength(8);
		});
	});

	describe("mixed directives", () => {
		it("scores partial when some bots blocked and some allowed", async () => {
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content: MIXED, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			// GPTBot blocked, ClaudeBot allowed, rest via * (allowed, /admin/ only)
			// exists(10) + syntax(10) + aiDirectives(15) + primary(25, GPTBot blocked) + secondary(10) + sitemap(10) + noGlobalBlock(15) = 95
			expect(result.score).toBe(95);
			expect(result.status).toBe("pass");
			expect(result.issues.some((i) => i.message.includes("GPTBot"))).toBe(true);
		});

		it("specific block overrides global block", async () => {
			const content = `User-agent: *
Disallow: /

User-agent: ClaudeBot
Allow: /

Sitemap: https://example.com/sitemap.xml
`;
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			// ClaudeBot allowed via specific block, all others blocked via *
			expect(result.details?.aiBots).toBeDefined();
			const bots = result.details?.aiBots as Record<string, string>;
			expect(bots.ClaudeBot).toBe("allowed");
			expect(bots.GPTBot).toBe("blocked");
		});
	});

	describe("empty Disallow", () => {
		it("treats empty Disallow as allow-all per RFC 9309", async () => {
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content: EMPTY_DISALLOW, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			const bots = result.details?.aiBots as Record<string, string>;
			expect(bots.GPTBot).toBe("allowed");
		});
	});

	describe("syntax validation", () => {
		it("reports issue for malformed file", async () => {
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content: MALFORMED, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			expect(result.issues.some((i) => i.message.includes("fehlerhafte Zeilen"))).toBe(true);
			expect(result.details?.syntaxValid).toBe(false);
		});
	});

	describe("case-insensitive matching", () => {
		it("matches bot names case-insensitively", async () => {
			const content = `user-agent: gptbot
Disallow: /

user-agent: claudebot
Allow: /

Sitemap: https://example.com/sitemap.xml
`;
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			const bots = result.details?.aiBots as Record<string, string>;
			expect(bots.GPTBot).toBe("blocked");
			expect(bots.ClaudeBot).toBe("allowed");
		});
	});

	describe("crawl-delay in details", () => {
		it("parses crawl-delay but does not affect score", async () => {
			const content = `User-agent: GPTBot
Crawl-delay: 10
Allow: /

User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
`;
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			// Score should not be affected by crawl-delay
			// exists(10) + syntax(10) + aiDirectives(15) + primary(30) + secondary(10) + sitemap(10) + noGlobalBlock(15) = 100
			expect(result.score).toBe(100);
		});
	});

	describe("duplicate User-Agent groups", () => {
		it("uses first-match for duplicate bot blocks (first block wins)", async () => {
			const content = `User-agent: GPTBot
Disallow: /

User-agent: GPTBot
Allow: /

User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
`;
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			const bots = result.details?.aiBots as Record<string, string>;
			// First GPTBot block has Disallow: / — first match wins per RFC 9309
			expect(bots.GPTBot).toBe("blocked");
		});

		it("detects duplicate user-agents and exposes in details", async () => {
			const content = `User-agent: GPTBot
Disallow: /

User-agent: GPTBot
Allow: /

User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
`;
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			const dupes = result.details?.duplicateUserAgents as string[];
			expect(dupes).toContain("gptbot");
		});

		it("emits warning issue for duplicate UA groups", async () => {
			const content = `User-agent: GPTBot
Disallow: /

User-agent: GPTBot
Allow: /

User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
`;
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			const dupeIssue = result.issues.find((i) => i.message.includes("Doppelte User-Agent"));
			expect(dupeIssue).toBeDefined();
			expect(dupeIssue?.severity).toBe("nice-to-have");
		});

		it("detects duplicate wildcard blocks", async () => {
			const content = `User-agent: *
Disallow: /

User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
`;
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			const dupes = result.details?.duplicateUserAgents as string[];
			expect(dupes).toContain("*");
			// First * block has Disallow: / — blanketDisallow should be true
			expect(result.details?.blanketDisallow).toBe(true);
		});

		it("does not report duplicates for multi-UA single block", async () => {
			const content = `User-agent: GPTBot
User-agent: ClaudeBot
Allow: /

User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
`;
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			const dupes = result.details?.duplicateUserAgents as string[];
			expect(dupes).toHaveLength(0);
		});

		it("no duplicate warning when UAs are unique", async () => {
			const content = `User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
`;
			const result = await robotsTxtCheck.run(
				makeContext({
					subResources: {
						"/robots.txt": { content, statusCode: 200, source: "/robots.txt" },
					},
				}),
			);

			const dupes = result.details?.duplicateUserAgents as string[];
			expect(dupes).toHaveLength(0);
			const dupeIssue = result.issues.find((i) => i.message.includes("Doppelte"));
			expect(dupeIssue).toBeUndefined();
		});
	});
});
