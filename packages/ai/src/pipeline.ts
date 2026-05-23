import type { ClaudeClient } from "./client.js";
import { withValidatedRetry } from "./retry.js";
import { CitationAnalysisSchema, SemanticAnalysisSchema } from "./schemas.js";
import type { AiResult, CitationAnalysisResult, SemanticAnalysisResult } from "./types.js";

// ── Text Extraction ─────────────────────────────────────────

function extractText(html: string, maxChars = 8000): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<nav[\s\S]*?<\/nav>/gi, "")
		.replace(/<footer[\s\S]*?<\/footer>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, maxChars);
}

// ── Semantic Analysis Prompt ────────────────────────────────

const SEMANTIC_ANALYSIS_PROMPT = `Du bist ein KI-Analyst für Website-Content-Qualität.
Analysiere den bereitgestellten Text und bewerte ihn auf einer Skala von 0-100 in fuenf Dimensionen.
Antworte ausschließlich mit validem JSON.

Das JSON muss folgende Struktur haben:
{
  "overallScore": <0-100, Gesamtbewertung>,
  "clarity": { "score": <0-100>, "assessment": "<Bewertung der sprachlichen Klarheit>" },
  "structure": { "score": <0-100>, "assessment": "<Bewertung der inhaltlichen Struktur>" },
  "factDensity": { "score": <0-100>, "assessment": "<Bewertung der Faktendichte>" },
  "topicFocus": { "score": <0-100>, "assessment": "<Bewertung des thematischen Fokus>" },
  "uniqueness": { "score": <0-100>, "assessment": "<Bewertung der Einzigartigkeit>" },
  "summary": "<1-2 Sätze Gesamtbewertung auf Deutsch>",
  "improvements": ["<Verbesserungsvorschlag 1>", "...(max 5)"]
}

Bewerte streng aber fair. Assessments und Verbesserungsvorschlaege auf Deutsch.`;

// ── Citation Analysis Prompt ────────────────────────────────

const CITATION_ANALYSIS_PROMPT = `Du bist ein KI-Analyst für Zitierbarkeit von Website-Inhalten durch KI-Systeme.
Analysiere den bereitgestellten Text und bewerte, wie gut er als Quelle für KI-Antworten geeignet ist.
Antworte ausschließlich mit validem JSON.

Das JSON muss folgende Struktur haben:
{
  "overallScore": <0-100, Gesamtbewertung>,
  "quotability": { "score": <0-100>, "assessment": "<Bewertung der Zitierbarkeit einzelner Aussagen>" },
  "authority": { "score": <0-100>, "assessment": "<Bewertung der Autorität und Glaubwürdigkeit>" },
  "specificity": { "score": <0-100>, "assessment": "<Bewertung der Spezifität und Konkretheit>" },
  "freshness": { "score": <0-100>, "assessment": "<Bewertung der Aktualität der Inhalte>" },
  "attribution": { "score": <0-100>, "assessment": "<Bewertung der Quellenangaben und Nachvollziehbarkeit>" },
  "summary": "<1-2 Sätze Gesamtbewertung auf Deutsch>",
  "improvements": ["<Verbesserungsvorschlag 1>", "...(max 5)"]
}

Bewerte streng aber fair. Assessments und Verbesserungsvorschlaege auf Deutsch.`;

// ── Prompt builders (#479) ──────────────────────────────────

/**
 * Prepends an optional locale-specific preamble to the semantic-analysis
 * core prompt. The core prompt contains the JSON-schema contract and must
 * not be modified by locale wiring — only enriched with a preamble.
 */
export function buildSemanticPrompt(preamble?: string): string {
	return preamble && preamble.trim().length > 0
		? `${preamble.trim()}\n\n${SEMANTIC_ANALYSIS_PROMPT}`
		: SEMANTIC_ANALYSIS_PROMPT;
}

export function buildCitationPrompt(preamble?: string): string {
	return preamble && preamble.trim().length > 0
		? `${preamble.trim()}\n\n${CITATION_ANALYSIS_PROMPT}`
		: CITATION_ANALYSIS_PROMPT;
}

export interface AnalyzeOptions {
	/**
	 * Full system prompt to use instead of the default. When omitted, the
	 * default German JSON-schema prompt is used. Typically set to
	 * `buildSemanticPrompt(preamble)` / `buildCitationPrompt(preamble)`.
	 */
	systemPromptOverride?: string;
}

// ── Semantic Quality Analysis ───────────────────────────────

export async function analyzeSemanticQuality(
	html: string,
	url: string,
	client: ClaudeClient,
	options: AnalyzeOptions = {},
): Promise<AiResult<SemanticAnalysisResult>> {
	const text = extractText(html);

	if (text.length < 50) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_FAILED",
				message: "Zu wenig Text auf der Seite für eine semantische Analyse.",
				attempts: 0,
			},
			usage: [],
		};
	}

	const userMessage = `Analysiere den folgenden Seiteninhalt von ${url}:\n\n${text}`;

	return withValidatedRetry({
		call: (prompt) =>
			client.complete({
				systemPrompt: options.systemPromptOverride ?? SEMANTIC_ANALYSIS_PROMPT,
				userMessage: prompt,
				operation: "semantic-analysis",
			}),
		prompt: userMessage,
		schema: SemanticAnalysisSchema,
	});
}

// ── Citation Readiness Analysis ─────────────────────────────

export async function analyzeCitationReadiness(
	html: string,
	url: string,
	client: ClaudeClient,
	options: AnalyzeOptions = {},
): Promise<AiResult<CitationAnalysisResult>> {
	const text = extractText(html);

	if (text.length < 50) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_FAILED",
				message: "Zu wenig Text auf der Seite für eine Zitations-Analyse.",
				attempts: 0,
			},
			usage: [],
		};
	}

	const userMessage = `Analysiere den folgenden Seiteninhalt von ${url} hinsichtlich KI-Zitierbarkeit:\n\n${text}`;

	return withValidatedRetry({
		call: (prompt) =>
			client.complete({
				systemPrompt: options.systemPromptOverride ?? CITATION_ANALYSIS_PROMPT,
				userMessage: prompt,
				operation: "citation-analysis",
			}),
		prompt: userMessage,
		schema: CitationAnalysisSchema,
	});
}
