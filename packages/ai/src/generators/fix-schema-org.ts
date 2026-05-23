import type { ClaudeClient } from "../client.js";
import { withValidatedRetry } from "../retry.js";
import { GeneratedFixSchema } from "../schemas.js";
import type { ValidatedGeneratedFix } from "../schemas.js";
import type { AiResult } from "../types.js";
import type { FixGeneratorContext } from "./types.js";
import { extractExistingJsonLd, extractSiteInfo } from "./utils.js";

const SYSTEM_PROMPT = `Du bist ein KI-Experte für Schema.org strukturierte Daten und AI-Readiness-Optimierung.
Deine Aufgabe ist es, ein JSON-LD Schema.org Markup zu generieren, das KI-Systemen die Inhalte der Website strukturiert bereitstellt.
Antworte ausschließlich mit validem JSON.

Das JSON muss exakt folgende Struktur haben:
{
  "checkId": "schema-org",
  "content": "<JSON-LD Markup als String>",
  "filename": "schema.jsonld",
  "method": "ai-generated"
}

Regeln für den content:
- Valides JSON-LD mit @context: "https://schema.org"
- Verwende @graph Array für mehrere Typen
- Mindestens Organization oder WebSite als Basis-Typ
- Bestimme den Seitentyp aus URL-Pfad und Inhalt (Article, Product, FAQPage, LocalBusiness, etc.)
- Alle Pflichtfelder pro Typ müssen vorhanden sein (z.B. Organization: name, url; Article: headline)
- Für unbekannte Werte verwende "[BITTE ANPASSEN]" als Platzhalter
- Der content String muss als valides JSON parsebar sein
- Verwende \\n für Zeilenumbrueche im JSON-String`;

export async function generateSchemaOrgFix(
	ctx: FixGeneratorContext,
	client: ClaudeClient,
): Promise<AiResult<ValidatedGeneratedFix>> {
	const info = extractSiteInfo(ctx.html);

	if (info.bodyText.length < 50) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_FAILED",
				message: "Zu wenig Text auf der Seite für eine Schema.org Generierung.",
				attempts: 0,
			},
			usage: [],
		};
	}

	const existingJsonLd = extractExistingJsonLd(ctx.html);
	const details = ctx.check.details as Record<string, unknown> | undefined;

	const parts: string[] = [
		`Generiere JSON-LD Schema.org Markup für ${ctx.url}.`,
		"",
		"Seitenkontext:",
	];
	if (info.title) parts.push(`- Titel: ${info.title}`);
	if (info.metaDescription) parts.push(`- Beschreibung: ${info.metaDescription}`);
	if (info.headings.length > 0)
		parts.push(`- Ueberschriften: ${info.headings.slice(0, 8).join(", ")}`);

	if (details?.typesFound && Array.isArray(details.typesFound)) {
		parts.push(`- Vorhandene Schema-Typen: ${(details.typesFound as string[]).join(", ")}`);
	}
	if (existingJsonLd.length > 0) {
		parts.push("", "Vorhandenes JSON-LD:");
		parts.push(existingJsonLd.slice(0, 2).join("\n").slice(0, 2000));
	}

	parts.push("", `Seiteninhalt (gekuerzt):\n${info.bodyText.slice(0, 3000)}`);

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
