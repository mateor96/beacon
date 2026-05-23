import { describe, expect, it } from "vitest";
import { generateRobotsTxtFix } from "../../generators/fix-robots-txt.js";
import { createContext } from "./fixtures.js";

describe("generateRobotsTxtFix", () => {
	it("generates complete robots.txt when no details", () => {
		const ctx = createContext("robots-txt");

		const result = generateRobotsTxtFix(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.checkId).toBe("robots-txt");
			expect(result.data.filename).toBe("robots.txt");
			expect(result.data.method).toBe("rule-based");
			expect(result.data.content).toContain("User-agent: *");
			expect(result.data.content).toContain("Allow: /");
			expect(result.data.content).toContain("Sitemap:");
		}
	});

	it("adds Allow blocks for blocked bots", () => {
		const ctx = createContext("robots-txt", {
			check: {
				id: "robots-txt",
				name: "robots-txt",
				status: "fail",
				category: "readability",
				severity: "critical",
				score: 30,
				summary: "AI bots blocked",
				issues: [],
				details: {
					aiBots: {
						GPTBot: "blocked",
						ClaudeBot: "blocked",
						"ChatGPT-User": "allowed",
						"Claude-Web": "allowed",
						PerplexityBot: "allowed",
						"Google-Extended": "allowed",
					},
					blanketDisallow: false,
					sitemaps: ["https://example.com/sitemap.xml"],
				},
			},
		});

		const result = generateRobotsTxtFix(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.content).toContain("User-agent: GPTBot");
			expect(result.data.content).toContain("User-agent: ClaudeBot");
			// ChatGPT-User is already allowed, should NOT have an explicit block
			expect(result.data.content).not.toContain("User-agent: ChatGPT-User");
		}
	});

	it("uses existing sitemaps from details", () => {
		const ctx = createContext("robots-txt", {
			check: {
				id: "robots-txt",
				name: "robots-txt",
				status: "fail",
				category: "readability",
				severity: "critical",
				score: 30,
				summary: "Issues",
				issues: [],
				details: {
					aiBots: {},
					sitemaps: ["https://example.com/sitemap.xml", "https://example.com/sitemap-pages.xml"],
				},
			},
		});

		const result = generateRobotsTxtFix(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.content).toContain("Sitemap: https://example.com/sitemap.xml");
			expect(result.data.content).toContain("Sitemap: https://example.com/sitemap-pages.xml");
		}
	});

	it("returns empty usage array (no API call)", () => {
		const ctx = createContext("robots-txt");
		const result = generateRobotsTxtFix(ctx);

		expect(result.usage).toEqual([]);
	});

	it("falls back to origin/sitemap.xml when no sitemaps known", () => {
		const ctx = createContext("robots-txt");
		const result = generateRobotsTxtFix(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.content).toContain("Sitemap: https://example.com/sitemap.xml");
		}
	});
});
