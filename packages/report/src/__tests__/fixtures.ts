import type { ScanCheck } from "@beacon/shared";
import type { ReportInput } from "../types.js";

export function makeReportInput(overrides?: Partial<ReportInput>): ReportInput {
	const checks: ScanCheck[] = [
		{
			id: "llms-txt",
			name: "llms.txt",
			status: "pass",
			category: "readability",
			severity: "critical",
			score: 100,
			summary: "llms.txt vorhanden und korrekt konfiguriert.",
			issues: [],
		},
		{
			id: "robots-txt",
			name: "robots.txt KI-Crawler",
			status: "warn",
			category: "readability",
			severity: "critical",
			score: 60,
			summary: "robots.txt vorhanden, aber einige KI-Crawler sind blockiert.",
			issues: [
				{
					message: "GPTBot wird durch Disallow-Regel blockiert.",
					severity: "important",
				},
			],
		},
		{
			id: "schema-org",
			name: "Schema.org / JSON-LD",
			status: "fail",
			category: "readability",
			severity: "important",
			score: 0,
			summary: "Kein Schema.org Markup gefunden.",
			issues: [
				{
					message: "Keine JSON-LD Structured Data vorhanden.",
					severity: "critical",
				},
				{
					message: "Kein Organization-Schema definiert.",
					severity: "important",
				},
			],
		},
	];

	return {
		url: "https://example.com",
		scannedAt: "2026-03-14T12:00:00Z",
		overallScore: 72,
		readinessLevel: 2,
		levelScores: {
			readability: 80,
			interactivity: 45,
			transactional: null,
		},
		checks,
		reportTexts: {
			executiveSummary:
				"Die Website example.com erreicht einen Beacon-Score von 72/100 und befindet sich auf Level 2 (Strukturiert). Die Grundlagen für KI-Sichtbarkeit sind gelegt, es bestehen jedoch Optimierungspotenziale bei der strukturierten Datenauszeichnung.",
			checkSummaries: {
				"llms-txt":
					"Die llms.txt Datei ist korrekt konfiguriert und bietet KI-Agenten alle notwendigen Informationen.",
				"robots-txt": "Die robots.txt erlaubt die meisten KI-Crawler, blockiert jedoch GPTBot.",
				"schema-org":
					"Es wurde kein strukturiertes Markup im JSON-LD-Format gefunden. Dies erschwert KI-Systemen die Extraktion von Unternehmensinformationen.",
			},
			categoryAssessments: {
				readability:
					"Die Lesbarkeit für KI-Systeme ist gut, wird aber durch fehlende Schema.org-Daten eingeschraenkt.",
				interactivity:
					"Interaktive KI-Features wie WebMCP und AGENTS.md sind noch nicht implementiert.",
				transactional: "Die Website unterstützt transaktionale KI-Interaktionen vollständig.",
			},
			recommendations: [
				"Schema.org JSON-LD Markup für Organization und WebSite hinzufügen.",
				"GPTBot in robots.txt freigeben, um die Sichtbarkeit in ChatGPT zu erhöhen.",
				"AGENTS.md Datei erstellen, um KI-Agenten Interaktionspfade bereitzustellen.",
			],
			conclusion:
				"Mit einem Score von 72/100 ist example.com bereits gut für die KI-Aera aufgestellt. Durch die Umsetzung der empfohlenen Maßnahmen kann das Level 3 (Optimiert) erreicht werden.",
		},
		...overrides,
	};
}
