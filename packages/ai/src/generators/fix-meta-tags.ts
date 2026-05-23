import type { ClaudeClient } from "../client.js";
import { withValidatedRetry } from "../retry.js";
import { GeneratedFixSchema } from "../schemas.js";
import type { ValidatedGeneratedFix } from "../schemas.js";
import type { AiResult } from "../types.js";
import type { FixGeneratorContext } from "./types.js";
import { extractHeadSection, extractText } from "./utils.js";

const SYSTEM_PROMPT = `Du bist ein KI-Experte für Meta-Tags und AI-Readiness-Optimierung von Websites.
Deine Aufgabe ist es, fehlende oder fehlerhafte Meta-Tags zu generieren, die die KI-Sichtbarkeit der Website verbessern.
Antworte ausschließlich mit validem JSON.

Das JSON muss exakt folgende Struktur haben:
{
  "checkId": "meta-tags",
  "content": "<HTML Meta-Tags als String mit \\n für Zeilenumbrueche>",
  "filename": "meta-tags.html",
  "method": "ai-generated"
}

Regeln für den content:
- Generiere NUR fehlende oder fehlerhafte Tags
- Title-Tag: 10-60 Zeichen, beschreibend
- Meta-Description: 50-160 Zeichen, zusammenfassend
- Open Graph Tags: og:title, og:description, og:image, og:type, og:url
- Twitter Card Tags: twitter:card, twitter:title, twitter:description
- Canonical Link und lang-Attribut falls fehlend
- Valides HTML, ein Tag pro Zeile
- Verwende \\n für Zeilenumbrueche im JSON-String
- Für og:image verwende "[BITTE ANPASSEN]" als Platzhalter
- Tag-Inhalte in der Sprache der Website`;

export async function generateMetaTagsFix(
	ctx: FixGeneratorContext,
	client: ClaudeClient,
): Promise<AiResult<ValidatedGeneratedFix>> {
	const bodyText = extractText(ctx.html, 2000);

	if (bodyText.length < 50) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_FAILED",
				message: "Zu wenig Text auf der Seite für eine Meta-Tags Generierung.",
				attempts: 0,
			},
			usage: [],
		};
	}

	const headSection = extractHeadSection(ctx.html);
	const details = ctx.check.details as Record<string, unknown> | undefined;

	const missingTags: string[] = [];
	if (!details?.title) missingTags.push("title");
	if (!details?.hasDescription) missingTags.push("meta description");
	if (!details?.hasCanonical) missingTags.push("canonical link");
	if (!details?.htmlLang) missingTags.push("lang attribute");

	const parts: string[] = [
		`Generiere fehlende Meta-Tags für ${ctx.url}.`,
		"",
		`Fehlende Tags: ${missingTags.length > 0 ? missingTags.join(", ") : "allgemeine Optimierung"}`,
	];

	if (headSection) {
		parts.push("", "Vorhandener <head>-Bereich:", headSection.slice(0, 2000));
	}

	parts.push("", `Seiteninhalt (gekuerzt):\n${bodyText}`);

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
