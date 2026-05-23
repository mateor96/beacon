import type { ClaudeClient } from "../client.js";
import { withValidatedRetry } from "../retry.js";
import { GeneratedFixSchema } from "../schemas.js";
import type { ValidatedGeneratedFix } from "../schemas.js";
import type { AiResult } from "../types.js";
import type { FixGeneratorContext } from "./types.js";
import { extractSiteInfo } from "./utils.js";

const SYSTEM_PROMPT = `Du bist ein KI-Experte für AI-Readiness-Optimierung und AGENTS.md Dateien.
Deine Aufgabe ist es, eine AGENTS.md Datei zu generieren, die KI-Agenten beschreibt welche Interaktionen auf der Website möglich sind.
Antworte ausschließlich mit validem JSON.

Das JSON muss exakt folgende Struktur haben:
{
  "checkId": "agents-md",
  "content": "<Inhalt der AGENTS.md Datei mit \\n für Zeilenumbrueche>",
  "filename": "agents.md",
  "method": "ai-generated"
}

Regeln für den content:
- Genau ein H1-Header mit dem Namen der Website/Organisation
- H2-Sektion "General" mit allgemeiner Beschreibung
- H2-Sektion "Agents" oder "Agent Types" mit unterstützten Agenten-Typen
- H2-Sektion "Capabilities" mit Bullet-Points der erlaubten Aktionen
- H2-Sektion "Data & Privacy" mit Datenschutzhinweisen
- H2-Sektion "Contact" mit Kontaktmöglichkeit (Platzhalter falls unbekannt)
- Reines Markdown, KEIN HTML
- Mindestens 200 Zeichen Gesamtlänge
- Alle Inhalte auf Englisch
- Verwende \\n für Zeilenumbrueche im JSON-String
- Bestimme den Website-Typ (E-Commerce, Blog, SaaS, Corporate) aus dem Inhalt und passe die Capabilities an`;

export async function generateAgentsMdFix(
	ctx: FixGeneratorContext,
	client: ClaudeClient,
): Promise<AiResult<ValidatedGeneratedFix>> {
	const info = extractSiteInfo(ctx.html);

	if (info.bodyText.length < 50) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_FAILED",
				message: "Zu wenig Text auf der Seite für eine AGENTS.md Generierung.",
				attempts: 0,
			},
			usage: [],
		};
	}

	const parts: string[] = [
		`Generiere eine AGENTS.md Datei für ${ctx.url}.`,
		"",
		"Website-Kontext:",
	];
	if (info.title) parts.push(`- Name: ${info.title}`);
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
