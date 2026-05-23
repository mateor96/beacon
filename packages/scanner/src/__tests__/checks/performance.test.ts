import type { CheckContext } from "@beacon/shared";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

const { default: performanceCheck } = await import("../../checks/performance.js");

// ── Helpers ─────────────────────────────────────────────────

function makeContext(overrides: Partial<CheckContext> = {}): CheckContext {
	const html =
		overrides.html ?? "<html><head><title>Test</title></head><body><p>Hello</p></body></html>";
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

function makeLargeHtml(sizeKb: number): string {
	const padding = "x".repeat(sizeKb * 1024);
	return `<html><head><title>Test</title></head><body><p>${padding}</p></body></html>`;
}

function makeComplexDom(nodeCount: number): string {
	const divs = "<div>x</div>".repeat(nodeCount);
	return `<html><head><title>Test</title></head><body>${divs}</body></html>`;
}

function makeInlineScripts(count: number, size = 600): string {
	const script = `<script>${"x".repeat(size)}</script>`;
	return `<html><head><title>Test</title></head><body>${script.repeat(count)}</body></html>`;
}

function makeContentHtml(textWords: number, noiseKb: number): string {
	const text = Array(textWords).fill("Wort").join(" ");
	// Use script tags as noise so they get stripped from content ratio calculation
	const noise = `<script>${"x".repeat(noiseKb * 1024)}</script>`;
	return `<html><head><title>Test</title></head><body><main><p>${text}</p></main>${noise}</body></html>`;
}

// ── Tests ───────────────────────────────────────────────────

describe("performance check", () => {
	describe("metadata", () => {
		it("has correct id, category, and severity", () => {
			expect(performanceCheck.id).toBe("performance");
			expect(performanceCheck.category).toBe("readability");
			expect(performanceCheck.severity).toBe("nice-to-have");
		});
	});

	describe("pass and warn status", () => {
		it("returns pass for small efficient page", async () => {
			const result = await performanceCheck.run(makeContext());

			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(80);
		});

		it("returns warn for page with some issues", async () => {
			// 3 redirects = 0pts redirect, large inline = penalty, moderate noise
			const html = makeContentHtml(10, 50);
			const result = await performanceCheck.run(
				makeContext({
					html,
					parsedHtml: parse(html),
					redirects: ["https://a.com", "https://b.com", "https://c.com"],
				}),
			);

			expect(result.status).toBe("warn");
			expect(result.score).toBeGreaterThanOrEqual(40);
			expect(result.score).toBeLessThan(80);
		});
	});

	describe("htmlSize", () => {
		it("gives full points for small HTML", async () => {
			const result = await performanceCheck.run(makeContext());

			expect(result.issues.some((i) => i.message.includes("HTML-Datei"))).toBe(false);
		});

		it("gives 0 points with issue for > 1MB HTML", async () => {
			const html = makeLargeHtml(1100);
			const ctx = makeContext({ html, parsedHtml: parse(html) });
			const result = await performanceCheck.run(ctx);

			expect(result.issues.some((i) => i.message.includes("HTML-Datei"))).toBe(true);
			expect(result.issues.some((i) => i.severity === "important")).toBe(true);
		});
	});

	describe("redirectCount", () => {
		it("gives full points for no redirects", async () => {
			const result = await performanceCheck.run(makeContext({ redirects: [] }));

			expect(result.issues.some((i) => i.message.includes("Weiterleitung"))).toBe(false);
		});

		it("gives partial points for 1 redirect", async () => {
			const result = await performanceCheck.run(
				makeContext({ redirects: ["https://example.com/r1"] }),
			);

			expect(result.issues.some((i) => i.message.includes("Weiterleitung"))).toBe(false);
		});

		it("gives 0 points with issue for 3+ redirects", async () => {
			const result = await performanceCheck.run(
				makeContext({
					redirects: ["https://example.com/r1", "https://example.com/r2", "https://example.com/r3"],
				}),
			);

			expect(result.issues.some((i) => i.message.includes("Weiterleitung"))).toBe(true);
			expect(result.issues.some((i) => i.severity === "important")).toBe(true);
		});
	});

	describe("domComplexity", () => {
		it("gives full points for simple DOM", async () => {
			const result = await performanceCheck.run(makeContext());

			expect(result.issues.some((i) => i.message.includes("Seitenstruktur"))).toBe(false);
		});

		it("gives 0 points with issue for > 5000 nodes", async () => {
			const html = makeComplexDom(5100);
			const ctx = makeContext({ html, parsedHtml: parse(html) });
			const result = await performanceCheck.run(ctx);

			expect(result.issues.some((i) => i.message.includes("Seitenstruktur"))).toBe(true);
			expect(result.issues.some((i) => i.severity === "important")).toBe(true);
		});
	});

	describe("contentToNoiseRatio", () => {
		it("gives full points for high content ratio", async () => {
			// Lots of text, minimal noise
			const html = makeContentHtml(500, 0);
			const ctx = makeContext({ html, parsedHtml: parse(html) });
			const result = await performanceCheck.run(ctx);

			expect(result.issues.some((i) => i.message.includes("Inhalt-zu-Code-Verhältnis"))).toBe(
				false,
			);
		});

		it("gives 0 points with critical issue for very low ratio", async () => {
			// Very little text, lots of noise
			const html = makeContentHtml(1, 100);
			const ctx = makeContext({ html, parsedHtml: parse(html) });
			const result = await performanceCheck.run(ctx);

			expect(result.issues.some((i) => i.message.includes("Inhalt-zu-Code-Verhältnis"))).toBe(true);
			expect(result.issues.some((i) => i.severity === "critical")).toBe(true);
		});
	});

	describe("inlineCodeBloat", () => {
		it("gives full points for no large inline blocks", async () => {
			const result = await performanceCheck.run(makeContext());

			expect(result.issues.some((i) => i.message.includes("Code-Blöcke"))).toBe(false);
		});

		it("deducts points for multiple large inline scripts", async () => {
			const html = makeInlineScripts(7);
			const ctx = makeContext({ html, parsedHtml: parse(html) });
			const result = await performanceCheck.run(ctx);

			expect(result.issues.some((i) => i.message.includes("Code-Blöcke"))).toBe(true);
		});
	});

	describe("details object", () => {
		it("contains expected fields", async () => {
			const result = await performanceCheck.run(makeContext());
			const details = result.details as Record<string, unknown>;

			expect(details.responseTimeMs).toBeDefined();
			expect(details.htmlSizeKb).toBeDefined();
			expect(details.redirectCount).toBeDefined();
			expect(details.domNodeCount).toBeDefined();
			expect(details.largeInlineBlockCount).toBeDefined();
			expect(details.contentToNoiseRatio).toBeDefined();
			expect(details.contentToNoisePercent).toBeDefined();
		});

		it("responseTime is in details but not scored", async () => {
			const result = await performanceCheck.run(makeContext());
			const details = result.details as Record<string, unknown>;

			expect(details.responseTimeMs).toBe(100);
		});
	});
});
