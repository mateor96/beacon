import type { TokenUsage } from "@beacon/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	analyzeCitationReadiness,
	analyzeSemanticQuality,
	buildCitationPrompt,
	buildSemanticPrompt,
} from "../pipeline.js";

// ── Mock Client ─────────────────────────────────────────────

const VALID_SEMANTIC_RESPONSE = JSON.stringify({
	overallScore: 75,
	clarity: { score: 80, assessment: "Gut strukturierter Text." },
	structure: { score: 70, assessment: "Klare Gliederung." },
	factDensity: { score: 65, assessment: "Ausreichend Fakten." },
	topicFocus: { score: 85, assessment: "Starker thematischer Fokus." },
	uniqueness: { score: 75, assessment: "Einzigartige Perspektive." },
	summary: "Insgesamt gute Qualität mit Verbesserungspotenzial.",
	improvements: ["Mehr Daten einbinden", "Quellenangaben ergänzen"],
});

const VALID_CITATION_RESPONSE = JSON.stringify({
	overallScore: 70,
	quotability: { score: 75, assessment: "Gut zitierbare Aussagen." },
	authority: { score: 65, assessment: "Mittlere Autorität." },
	specificity: { score: 80, assessment: "Spezifische Angaben." },
	freshness: { score: 60, assessment: "Teils veraltete Inhalte." },
	attribution: { score: 70, assessment: "Gute Quellenangaben." },
	summary: "Solide Zitierbarkeit mit Raum für Verbesserung.",
	improvements: ["Aktualität erhöhen"],
});

const mockUsage: TokenUsage = {
	inputTokens: 500,
	outputTokens: 300,
	model: "claude-haiku-4-5-20251001",
	operation: "semantic-analysis",
	durationMs: 800,
};

function createMockClient(responseText: string) {
	return {
		complete: vi.fn().mockResolvedValue({
			text: responseText,
			usage: mockUsage,
		}),
	} as never;
}

// ── Fixtures ────────────────────────────────────────────────

const LONG_TEXT = "a".repeat(100);
const SHORT_TEXT = "short";

const HTML_WITH_TAGS = `
<html>
<head><style>body { color: red; }</style></head>
<body>
<nav>Navigation menu</nav>
<div>${LONG_TEXT}</div>
<script>console.log("evil");</script>
<footer>Footer content</footer>
</body>
</html>`;

const MINIMAL_HTML = `<p>${SHORT_TEXT}</p>`;

// ── analyzeSemanticQuality ──────────────────────────────────

describe("analyzeSemanticQuality", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns error when extracted text is too short (<50 chars)", async () => {
		const client = createMockClient(VALID_SEMANTIC_RESPONSE);

		const result = await analyzeSemanticQuality(MINIMAL_HTML, "https://example.com", client);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("VALIDATION_FAILED");
			expect(result.error.message).toContain("Zu wenig Text");
			expect(result.error.attempts).toBe(0);
		}
		expect(result.usage).toEqual([]);
	});

	it("strips script, style, nav, and footer tags from HTML", async () => {
		const client = createMockClient(VALID_SEMANTIC_RESPONSE);

		await analyzeSemanticQuality(HTML_WITH_TAGS, "https://example.com", client);

		const call = (client as unknown as { complete: ReturnType<typeof vi.fn> }).complete;
		const userMessage: string = call.mock.calls[0][0].userMessage;

		expect(userMessage).not.toContain("Navigation menu");
		expect(userMessage).not.toContain("console.log");
		expect(userMessage).not.toContain("Footer content");
		expect(userMessage).not.toContain("color: red");
		expect(userMessage).toContain("a".repeat(50));
	});

	it("truncates text to maxChars (8000 default)", async () => {
		const hugeHtml = `<p>${"x".repeat(10_000)}</p>`;
		const client = createMockClient(VALID_SEMANTIC_RESPONSE);

		await analyzeSemanticQuality(hugeHtml, "https://example.com", client);

		const call = (client as unknown as { complete: ReturnType<typeof vi.fn> }).complete;
		const userMessage: string = call.mock.calls[0][0].userMessage;
		// The text portion (after the URL prefix line) should be ≤ 8000 chars
		const textPart = userMessage.split("\n\n")[1];
		expect(textPart.length).toBeLessThanOrEqual(8000);
	});

	it("passes correct operation type", async () => {
		const client = createMockClient(VALID_SEMANTIC_RESPONSE);

		await analyzeSemanticQuality(HTML_WITH_TAGS, "https://example.com", client);

		const call = (client as unknown as { complete: ReturnType<typeof vi.fn> }).complete;
		expect(call.mock.calls[0][0].operation).toBe("semantic-analysis");
	});

	it("returns valid result for sufficient content", async () => {
		const client = createMockClient(VALID_SEMANTIC_RESPONSE);

		const result = await analyzeSemanticQuality(HTML_WITH_TAGS, "https://example.com", client);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.overallScore).toBe(75);
			expect(result.data.clarity.score).toBe(80);
			expect(result.data.improvements).toHaveLength(2);
		}
		expect(result.usage.length).toBeGreaterThan(0);
	});

	it("includes URL in user message", async () => {
		const client = createMockClient(VALID_SEMANTIC_RESPONSE);

		await analyzeSemanticQuality(HTML_WITH_TAGS, "https://test.de", client);

		const call = (client as unknown as { complete: ReturnType<typeof vi.fn> }).complete;
		expect(call.mock.calls[0][0].userMessage).toContain("https://test.de");
	});
});

// ── analyzeCitationReadiness ────────────────────────────────

describe("analyzeCitationReadiness", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns error when extracted text is too short (<50 chars)", async () => {
		const client = createMockClient(VALID_CITATION_RESPONSE);

		const result = await analyzeCitationReadiness(MINIMAL_HTML, "https://example.com", client);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("VALIDATION_FAILED");
			expect(result.error.message).toContain("Zu wenig Text");
		}
	});

	it("calls client with citation-analysis operation", async () => {
		const client = createMockClient(VALID_CITATION_RESPONSE);

		await analyzeCitationReadiness(HTML_WITH_TAGS, "https://example.com", client);

		const call = (client as unknown as { complete: ReturnType<typeof vi.fn> }).complete;
		expect(call.mock.calls[0][0].operation).toBe("citation-analysis");
	});

	it("returns valid citation result for sufficient content", async () => {
		const client = createMockClient(VALID_CITATION_RESPONSE);

		const result = await analyzeCitationReadiness(HTML_WITH_TAGS, "https://example.com", client);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.overallScore).toBe(70);
			expect(result.data.quotability.score).toBe(75);
			expect(result.data.freshness.assessment).toContain("veraltete");
		}
	});

	it("strips HTML tags the same way as semantic analysis", async () => {
		const client = createMockClient(VALID_CITATION_RESPONSE);

		await analyzeCitationReadiness(HTML_WITH_TAGS, "https://example.com", client);

		const call = (client as unknown as { complete: ReturnType<typeof vi.fn> }).complete;
		const userMessage: string = call.mock.calls[0][0].userMessage;

		expect(userMessage).not.toContain("<script");
		expect(userMessage).not.toContain("<nav");
		expect(userMessage).not.toContain("<footer");
		expect(userMessage).not.toContain("<style");
	});

	it("includes citation-specific context in user message", async () => {
		const client = createMockClient(VALID_CITATION_RESPONSE);

		await analyzeCitationReadiness(HTML_WITH_TAGS, "https://example.com", client);

		const call = (client as unknown as { complete: ReturnType<typeof vi.fn> }).complete;
		expect(call.mock.calls[0][0].userMessage).toContain("Zitierbarkeit");
	});
});

describe("buildSemanticPrompt / buildCitationPrompt (#479)", () => {
	it("returns the core prompt unchanged when no preamble is supplied", () => {
		expect(buildSemanticPrompt()).toContain("overallScore");
		expect(buildSemanticPrompt()).toContain("Bewerte streng");
		expect(buildCitationPrompt()).toContain("quotability");
	});

	it("returns the core prompt unchanged when preamble is empty or whitespace", () => {
		expect(buildSemanticPrompt("")).toContain("overallScore");
		expect(buildSemanticPrompt("   \n\t  ")).toContain("overallScore");
		expect(buildSemanticPrompt("")).not.toMatch(/^\s+/);
	});

	it("prepends trimmed preamble above the core prompt", () => {
		const sem = buildSemanticPrompt("  Reply only in fr.  \n");
		expect(sem.startsWith("Reply only in fr.")).toBe(true);
		expect(sem).toContain("\n\n");
		expect(sem).toContain("overallScore");

		const cit = buildCitationPrompt("LOCALE_HEADER");
		expect(cit.startsWith("LOCALE_HEADER")).toBe(true);
		expect(cit).toContain("quotability");
	});

	it("analyzeSemanticQuality forwards systemPromptOverride to the client", async () => {
		const client = createMockClient(VALID_SEMANTIC_RESPONSE);
		await analyzeSemanticQuality(HTML_WITH_TAGS, "https://example.com", client, {
			systemPromptOverride: "CUSTOM_PROMPT",
		});
		const call = (client as unknown as { complete: ReturnType<typeof vi.fn> }).complete;
		expect(call.mock.calls[0][0].systemPrompt).toBe("CUSTOM_PROMPT");
	});
});
