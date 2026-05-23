import type { SentimentInput } from "./types.js";

export const SENTIMENT_SYSTEM_PROMPT = `Du bist ein Sentiment-Analyst für Markenerwaenungen in KI-Antworten.
Klassifiziere jede Erwähnung als "positive", "neutral" oder "negative" mit einem Konfidenzwert (0-1).

Regeln:
- Bewerte NUR die Stimmung gegenüber der genannten Marke, nicht den Gesamtton.
- Sarkasmus oder ironisches Lob = "negative".
- Backhanded compliments (Lob mit versteckter Kritik) = "negative".
- Gemischtes Sentiment = "neutral" mit niedriger Konfidenz (< 0.5).
- Reine Faktennennung ohne Wertung = "neutral".
- Kontext unter 20 Zeichen = "neutral" mit Konfidenz 0.3.
- Empfehlungen mit positiven Woertern = "positive" mit hoher Konfidenz.
- Kritik, Warnungen, Nachteile = "negative".

Antworte ausschließlich mit validem JSON:
{
  "results": [
    { "mentionIndex": 0, "sentiment": "positive", "confidence": 0.92 },
    { "mentionIndex": 1, "sentiment": "neutral", "confidence": 0.75 }
  ]
}

Gib für JEDE Eingabe-ID genau ein Ergebnis zurück.`;

export function buildUserMessage(mentions: SentimentInput[]): string {
	const items = mentions
		.map((m, i) => {
			const ctx = m.contextText.length > 200 ? m.contextText.slice(0, 200) : m.contextText;
			return `[${i}] Marke: "${m.brandName}" | Typ: ${m.mentionType} | Engine: ${m.aiEngine}\n"""${ctx}"""`;
		})
		.join("\n\n");

	return `Klassifiziere das Sentiment der folgenden ${mentions.length} Markenerwaenung(en):\n\n${items}`;
}
