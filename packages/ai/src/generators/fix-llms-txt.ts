/**
 * @deprecated Superseded by `packages/ai/src/generators/llms-txt.ts` (#233),
 * which writes versioned, hash-deduplicated rows into the `generated_fixes`
 * table introduced in #223 with a deterministic template fallback.
 *
 * This file is still LIVE: dispatched by `generateFix("llms-txt", ...)` via
 * the `fix` queue (ADR #149) and writes legacy `scan.fixes` JSONB. Do not
 * delete until the `fix`-queue migration follow-up lands.
 */
import type { ClaudeClient } from "../client.js";
import { withValidatedRetry } from "../retry.js";
import { GeneratedFixSchema } from "../schemas.js";
import type { ValidatedGeneratedFix } from "../schemas.js";
import type { AiResult } from "../types.js";
import type { FixGeneratorContext } from "./types.js";
import { extractSiteInfo } from "./utils.js";

const SYSTEM_PROMPT = `Du bist ein KI-Experte für AI-Readiness-Optimierung von Websites.
Deine Aufgabe ist es, eine llms.txt Datei zu generieren, die KI-Systemen einen strukturierten Überblick über die Website gibt.
Antworte ausschließlich mit validem JSON.

Das JSON muss exakt folgende Struktur haben:
{
  "checkId": "llms-txt",
  "content": "<Inhalt der llms.txt Datei mit \\n für Zeilenumbrueche>",
  "filename": "llms.txt",
  "method": "ai-generated"
}

Regeln für den content:
- Genau ein H1-Header (# Firmenname) als erste Zeile
- Ein Blockquote (> Kurzbeschreibung in 1-2 Sätzen) direkt nach dem H1
- Mindestens 2 H2-Sektionen (## Abschnitt) mit beschreibenden Markdown-Links
- Links im Format: - [Titel](URL): Beschreibung
- Reines Markdown, KEIN HTML
- Mindestens 200 Zeichen Gesamtlänge
- Alle Inhalte auf Englisch
- Verwende \\n für Zeilenumbrueche im JSON-String`;

export async function generateLlmsTxtFix(
	ctx: FixGeneratorContext,
	client: ClaudeClient,
): Promise<AiResult<ValidatedGeneratedFix>> {
	const info = extractSiteInfo(ctx.html);

	if (info.bodyText.length < 50) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_FAILED",
				message: "Zu wenig Text auf der Seite für eine llms.txt Generierung.",
				attempts: 0,
			},
			usage: [],
		};
	}

	const parts: string[] = [
		`Generiere eine llms.txt Datei für die Website ${ctx.url}.`,
		"",
		"Website-Kontext:",
	];
	if (info.title) parts.push(`- Titel: ${info.title}`);
	if (info.metaDescription) parts.push(`- Beschreibung: ${info.metaDescription}`);
	if (info.headings.length > 0) parts.push(`- Ueberschriften: ${info.headings.join(", ")}`);

	if (ctx.check.issues.length > 0) {
		parts.push("", "Gefundene Probleme:");
		for (const issue of ctx.check.issues.slice(0, 5)) {
			parts.push(`- [${issue.severity}] ${issue.message}`);
		}
	}

	parts.push("", `Seiteninhalt (gekuerzt):\n${info.bodyText}`);

	const userMessage = parts.join("\n");

	return withValidatedRetry({
		call: (prompt) =>
			client.complete({
				systemPrompt: SYSTEM_PROMPT,
				userMessage: prompt,
				operation: "fix-generation",
			}),
		prompt: userMessage,
		schema: GeneratedFixSchema,
	});
}
