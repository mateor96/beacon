import type { ScanResult } from "@beacon/shared";
import { LEVEL_NAMES } from "@beacon/shared";
import type { ClaudeClient } from "./client.js";
import { withValidatedRetry } from "./retry.js";
import { ReportTextsSchema } from "./schemas.js";
import type { ValidatedReportTexts } from "./schemas.js";
import type { AiResult } from "./types.js";

// ── System Prompt ───────────────────────────────────────────

const SYSTEM_PROMPT = `Du bist ein KI-Experte für AI-Readiness-Reports von Websites.
Deine Aufgabe ist es, basierend auf Scan-Ergebnissen professionelle, deutschsprachige Report-Texte zu generieren.
Antworte ausschließlich mit validem JSON.

Das JSON muss folgende Struktur haben:
{
  "executiveSummary": "<2-4 Sätze Zusammenfassung des Gesamtergebnisses, Staerken und Schwaechen>",
  "checkSummaries": {
    "<checkId>": {
      "title": "<Kurztitel des Checks>",
      "assessment": "<Bewertung des Check-Ergebnisses, 1-3 Sätze>",
      "recommendation": "<Konkreter Handlungsvorschlag, 1-2 Sätze>"
    }
  },
  "categoryAssessments": {
    "readability": {
      "title": "<Titel für Lesbarkeits-Kategorie>",
      "summary": "<Bewertung der Lesbarkeit für KI-Systeme, 2-3 Sätze>",
      "score": <0-100>
    },
    "interactivity": {
      "title": "<Titel für Interaktivitäts-Kategorie>",
      "summary": "<Bewertung der Interaktivität mit KI-Agents, 2-3 Sätze>",
      "score": <0-100>
    },
    "transactional": {
      "title": "<Titel für Transaktions-Kategorie>",
      "summary": "<Bewertung der Transaktionsfaehigkeit, 2-3 Sätze>",
      "score": <0-100>
    }
  },
  "recommendations": [
    {
      "priority": <1-10, 1 = hoechste Priorität>,
      "title": "<Kurztitel der Empfehlung>",
      "description": "<Beschreibung und Begründung, 1-2 Sätze>",
      "impact": "<high | medium | low>"
    }
  ],
  "conclusion": "<2-3 Sätze Fazit mit Ausblick und nächsten Schritten>"
}

Regeln:
- checkSummaries MUSS für jeden Check-ID aus den Scan-Ergebnissen einen Eintrag enthalten.
- recommendations sortiert nach Priorität (1 = wichtigste), maximal 10 Empfehlungen.
- categoryAssessments.score MUSS den tatsächlichen Scores aus den Scan-Daten entsprechen.
- Alle Texte auf Deutsch, professionell und konkret.
- Fokus auf umsetzbare Empfehlungen, nicht auf allgemeine Aussagen.`;

// ── Data Preparation ────────────────────────────────────────

function prepareScanDataForPrompt(scanResult: ScanResult): string {
	const leanChecks = scanResult.checks.map((check) => ({
		id: check.id,
		name: check.name,
		status: check.status,
		score: check.score,
		summary: check.summary,
		issues: check.issues,
	}));

	const leanData = {
		url: scanResult.url,
		...(scanResult.finalUrl &&
			scanResult.finalUrl !== scanResult.url && { finalUrl: scanResult.finalUrl }),
		overallScore: scanResult.overallScore,
		readinessLevel: scanResult.readinessLevel,
		readinessLevelName: LEVEL_NAMES[scanResult.readinessLevel],
		levelScores: scanResult.levelScores,
		checks: leanChecks,
	};

	return JSON.stringify(leanData, null, 2);
}

// ── Report Text Generation ──────────────────────────────────

export async function generateReportTexts(
	scanResult: ScanResult,
	client: ClaudeClient,
): Promise<AiResult<ValidatedReportTexts>> {
	if (scanResult.checks.length === 0) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_FAILED",
				message: "Keine Check-Ergebnisse vorhanden für Report-Generierung.",
				attempts: 0,
			},
			usage: [],
		};
	}

	const scanData = prepareScanDataForPrompt(scanResult);
	const userMessage = `Generiere die Report-Texte für folgende Scan-Ergebnisse:\n\n${scanData}`;

	return withValidatedRetry({
		call: (prompt) =>
			client.complete({
				systemPrompt: SYSTEM_PROMPT,
				userMessage: prompt,
				operation: "report-generation",
			}),
		prompt: userMessage,
		schema: ReportTextsSchema,
	});
}
