import type { ScanResult } from "@beacon/shared";
import { describe, expect, it, vi } from "vitest";
import { generateReportTexts } from "../report-texts.js";
import { ReportTextsSchema } from "../schemas.js";

// ── Fixtures ────────────────────────────────────────────────

const VALID_CHECK_SUMMARY = {
	title: "LLMs.txt Check",
	assessment: "Die Datei ist vorhanden und korrekt formatiert.",
	recommendation: "Keine Änderungen erforderlich.",
};

const VALID_CATEGORY_ASSESSMENT = {
	title: "Lesbarkeit für KI-Systeme",
	summary:
		"Die Website ist gut strukturiert und für KI-Systeme lesbar. Verbesserungspotenzial bei der Semantik.",
	score: 80,
};

const VALID_RECOMMENDATION = {
	priority: 1,
	title: "Schema.org Markup hinzufügen",
	description: "Strukturierte Daten erhöhen die KI-Sichtbarkeit erheblich.",
	impact: "high" as const,
};

const VALID_REPORT_TEXTS = {
	executiveSummary:
		"Die Website erreicht einen AI-Readiness-Score von 72. Staerken liegen in der technischen Struktur, Schwaechen bei der semantischen Qualität.",
	checkSummaries: {
		"llms-txt": VALID_CHECK_SUMMARY,
		"robots-txt": { ...VALID_CHECK_SUMMARY, title: "Robots.txt Check" },
		"schema-org": { ...VALID_CHECK_SUMMARY, title: "Schema.org Check" },
		"content-structure": { ...VALID_CHECK_SUMMARY, title: "Content Structure" },
		performance: { ...VALID_CHECK_SUMMARY, title: "Performance" },
		"meta-tags": { ...VALID_CHECK_SUMMARY, title: "Meta Tags" },
		webmcp: { ...VALID_CHECK_SUMMARY, title: "WebMCP" },
		"agents-md": { ...VALID_CHECK_SUMMARY, title: "Agents.md" },
		"semantic-quality": { ...VALID_CHECK_SUMMARY, title: "Semantic Quality" },
		"citation-readiness": { ...VALID_CHECK_SUMMARY, title: "Citation Readiness" },
	},
	categoryAssessments: {
		readability: { ...VALID_CATEGORY_ASSESSMENT, title: "Lesbarkeit" },
		interactivity: { ...VALID_CATEGORY_ASSESSMENT, title: "Interaktivität", score: 45 },
		transactional: { ...VALID_CATEGORY_ASSESSMENT, title: "Transaktionsfaehigkeit", score: 100 },
	},
	recommendations: [VALID_RECOMMENDATION],
	conclusion:
		"Die Website hat solide Grundlagen für KI-Readiness. Nächster Schritt: Schema.org Markup implementieren.",
};

const mockScanResult: ScanResult = {
	id: "test-id",
	url: "https://example.com",
	status: "completed" as const,
	overallScore: 72,
	readinessLevel: 2 as const,
	levelScores: { readability: 80, interactivity: 45, transactional: null },
	checks: [],
	createdAt: "2026-03-14T12:00:00Z",
};

// ── ReportTextsSchema ──────────────────────────────────────

describe("ReportTextsSchema", () => {
	it("accepts valid data", () => {
		const result = ReportTextsSchema.safeParse(VALID_REPORT_TEXTS);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.executiveSummary).toBe(VALID_REPORT_TEXTS.executiveSummary);
			expect(result.data.recommendations).toHaveLength(1);
		}
	});

	it("rejects empty executiveSummary", () => {
		const invalid = { ...VALID_REPORT_TEXTS, executiveSummary: "" };
		const result = ReportTextsSchema.safeParse(invalid);
		expect(result.success).toBe(false);
		if (!result.success) {
			const paths = result.error.issues.map((i) => i.path.join("."));
			expect(paths).toContain("executiveSummary");
		}
	});

	it("rejects too many recommendations (>10)", () => {
		const tooMany = Array.from({ length: 11 }, (_, i) => ({
			...VALID_RECOMMENDATION,
			priority: i + 1 > 10 ? 10 : i + 1,
			title: `Empfehlung ${i + 1}`,
		}));
		const invalid = { ...VALID_REPORT_TEXTS, recommendations: tooMany };
		const result = ReportTextsSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});

	it("rejects missing categoryAssessments", () => {
		const { categoryAssessments: _, ...incomplete } = VALID_REPORT_TEXTS;
		const result = ReportTextsSchema.safeParse(incomplete);
		expect(result.success).toBe(false);
	});
});

// ── generateReportTexts ─────────────────────────────────────

describe("generateReportTexts", () => {
	it("returns error for empty checks", async () => {
		const mockClient = { complete: vi.fn() } as never;

		const result = await generateReportTexts(mockScanResult, mockClient);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("VALIDATION_FAILED");
			expect(result.error.message).toContain("Keine Check-Ergebnisse");
			expect(result.error.attempts).toBe(0);
		}
		expect(result.usage).toEqual([]);
	});

	it("calls withValidatedRetry for non-empty checks", async () => {
		const scanWithChecks: ScanResult = {
			...mockScanResult,
			checks: [
				{
					id: "llms-txt",
					name: "LLMs.txt",
					status: "pass",
					score: 100,
					summary: "Datei vorhanden",
					issues: [],
				},
			],
		};

		const mockClient = {
			complete: vi.fn().mockResolvedValue({
				text: JSON.stringify(VALID_REPORT_TEXTS),
				usage: {
					inputTokens: 500,
					outputTokens: 300,
					model: "claude-haiku-4-5-20251001",
					operation: "report-generation",
					durationMs: 1200,
				},
			}),
		} as never;

		const result = await generateReportTexts(scanWithChecks, mockClient);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.executiveSummary).toBe(VALID_REPORT_TEXTS.executiveSummary);
		}
		expect(result.usage.length).toBeGreaterThan(0);
	});

	it("includes input and final URL in prompt data for redirect scans", async () => {
		const scanWithChecks: ScanResult = {
			...mockScanResult,
			url: "https://example.com",
			finalUrl: "https://www.example.com/",
			checks: [
				{
					id: "llms-txt",
					name: "LLMs.txt",
					status: "pass",
					score: 100,
					summary: "Datei vorhanden",
					issues: [],
				},
			],
		};

		const complete = vi.fn().mockResolvedValue({
			text: JSON.stringify(VALID_REPORT_TEXTS),
			usage: {
				inputTokens: 500,
				outputTokens: 300,
				model: "claude-haiku-4-5-20251001",
				operation: "report-generation",
				durationMs: 1200,
			},
		});
		const mockClient = { complete } as never;

		const result = await generateReportTexts(scanWithChecks, mockClient);

		expect(result.ok).toBe(true);
		expect(complete).toHaveBeenCalledTimes(1);

		const userMessage = complete.mock.calls[0]?.[0]?.userMessage;
		expect(userMessage).toContain('"url": "https://example.com"');
		expect(userMessage).toContain('"finalUrl": "https://www.example.com/"');

		const promptPrefix = "Generiere die Report-Texte für folgende Scan-Ergebnisse:\n\n";
		const promptData = JSON.parse(userMessage.slice(promptPrefix.length)) as {
			url: string;
			finalUrl?: string;
		};

		expect(promptData.url).toBe("https://example.com");
		expect(promptData.finalUrl).toBe("https://www.example.com/");
	});
});
