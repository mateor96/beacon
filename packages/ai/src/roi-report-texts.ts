/**
 * ROI report AI text generation (#281).
 *
 * Generates executive summary, prioritized recommendations, and outlook
 * based on score development, milestones, and citation changes.
 * Follows the same pattern as report-texts.ts.
 */

import type { LevelScores, ReadinessLevel } from "@beacon/shared";
import type { ClaudeClient } from "./client.js";
import { withValidatedRetry } from "./retry.js";
import { RoiReportTextsSchema } from "./schemas.js";
import type { ValidatedRoiReportTexts } from "./schemas.js";
import type { AiResult } from "./types.js";

// ── Input Type ─────────────────────────────────────────────

export interface RoiReportTextInput {
	url: string;
	currentScore: number;
	baselineScore: number | null;
	scoreDelta: number;
	readinessLevel: ReadinessLevel;
	levelScores: LevelScores;
	subScoreDeltas?: {
		readability: number | null;
		interactivity: number | null;
		transactional: number | null;
	};
	milestones: Array<{ type: string; description: string }>;
	citationCount: number;
	citationDelta: number;
	daysSinceBaseline: number | null;
	failingChecks: Array<{ id: string; name: string; score: number; summary: string }>;
}

// ── System Prompt ──────────────────────────────────────────

const SYSTEM_PROMPT = `Du bist ein KI-Experte für AI-Readiness und ROI-Analyse von Websites.
Deine Aufgabe ist es, basierend auf Score-Entwicklungen, Milestones und Check-Ergebnissen
professionelle, deutschsprachige ROI-Texte für einen Fortschrittsbericht zu generieren.
Antworte ausschließlich mit validem JSON.

Das JSON muss folgende Struktur haben:
{
  "executiveSummary": "<2-4 Sätze Zusammenfassung der Fortschritte seit Baseline>",
  "recommendations": [
    {
      "priority": <1-5, 1 = hoechste Priorität>,
      "title": "<Kurztitel der Empfehlung>",
      "description": "<Konkreter Handlungsvorschlag, 2-3 Sätze>",
      "impact": "<high | medium | low>"
    }
  ],
  "outlook": "<2-3 Sätze Ausblick und nächste Schritte>"
}

Regeln:
- recommendations sortiert nach Priorität (1 = wichtigste), maximal 5 Empfehlungen.
- Fokus auf umsetzbare, konkrete Empfehlungen basierend auf den schlechtesten Checks.
- Bei fehlendem Baseline: Empfehlungen basierend auf aktuellem Stand ohne Vergleich.
- Alle Texte auf Deutsch, professionell und kundenorientiert.`;

// ── Data Preparation ───────────────────────────────────────

function prepareRoiDataForPrompt(input: RoiReportTextInput): string {
	const leanData = {
		url: input.url,
		currentScore: input.currentScore,
		baselineScore: input.baselineScore,
		scoreDelta: input.scoreDelta,
		readinessLevel: input.readinessLevel,
		levelScores: input.levelScores,
		subScoreDeltas: input.subScoreDeltas,
		milestones: input.milestones.slice(0, 10),
		citationCount: input.citationCount,
		citationDelta: input.citationDelta,
		daysSinceBaseline: input.daysSinceBaseline,
		failingChecks: input.failingChecks.slice(0, 10),
	};
	return JSON.stringify(leanData, null, 2);
}

// ── Generation ─────────────────────────────────────────────

export async function generateRoiReportTexts(
	input: RoiReportTextInput,
	client: ClaudeClient,
): Promise<AiResult<ValidatedRoiReportTexts>> {
	if (input.failingChecks.length === 0 && input.milestones.length === 0) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_FAILED",
				message: "Keine Daten vorhanden für ROI-Report-Generierung.",
				attempts: 0,
			},
			usage: [],
		};
	}

	const roiData = prepareRoiDataForPrompt(input);
	const userMessage = `Generiere die ROI-Report-Texte für folgende Fortschrittsdaten:\n\n${roiData}`;

	return withValidatedRetry({
		call: (prompt) =>
			client.complete({
				systemPrompt: SYSTEM_PROMPT,
				userMessage: prompt,
				operation: "roi-recommendation",
				maxTokens: 2048,
			}),
		prompt: userMessage,
		schema: RoiReportTextsSchema,
	});
}
