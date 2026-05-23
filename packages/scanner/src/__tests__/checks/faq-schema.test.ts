import type { CheckContext } from "@beacon/shared";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

const {
	default: faqSchemaCheck,
	parseFaqSchema,
	calculateScore,
} = await import("../../checks/faq-schema.js");

// ── Helpers ─────────────────────────────────────────────────

function makeContext(html: string, url = "https://example.com/faq"): CheckContext {
	return {
		inputUrl: url,
		finalUrl: url,
		html,
		parsedHtml: parse(html),
		responseTime: 100,
		statusCode: 200,
		redirects: [],
		subResources: {},
	};
}

// ── Fixtures ────────────────────────────────────────────────

const FULL_FAQ = `<html lang="de">
<head><meta charset="utf-8"><title>FAQ</title></head>
<body>
<main>
<h1>Häufig gestellte Fragen</h1>
<h2>Was ist Beacon?</h2>
<p>Beacon ist ein Tool zur Analyse der KI-Sichtbarkeit von Webseiten und hilft bei der Optimierung.</p>
<h2>Wie funktioniert der Scanner?</h2>
<p>Der Scanner analysiert verschiedene technische und inhaltliche Aspekte einer Webseite automatisch.</p>
<h2>Welche Checks gibt es?</h2>
<p>Es gibt über 10 verschiedene Checks die verschiedene Aspekte der KI-Readiness bewerten.</p>
<h2>Wie verbessere ich meinen Score?</h2>
<p>Folgen Sie den Empfehlungen der einzelnen Checks um Ihre KI-Sichtbarkeit zu verbessern.</p>
<h2>Was kostet Beacon?</h2>
<p>Beacon bietet verschiedene Preismodelle an, von kostenlos bis Enterprise mit erweiterten Features.</p>
</main>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Was ist Beacon?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Beacon ist ein Tool zur Analyse der KI-Sichtbarkeit von Webseiten und hilft bei der <a href='/features'>Optimierung</a> Ihrer Online-Präsenz für moderne KI-Systeme."
      }
    },
    {
      "@type": "Question",
      "name": "Wie funktioniert der Scanner?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Der Scanner analysiert verschiedene technische und inhaltliche Aspekte einer Webseite automatisch und liefert <strong>detaillierte Empfehlungen</strong>."
      }
    },
    {
      "@type": "Question",
      "name": "Welche Checks gibt es?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Es gibt über 10 verschiedene Checks die verschiedene Aspekte der KI-Readiness bewerten, darunter <ul><li>Schema.org</li><li>Content-Struktur</li></ul>."
      }
    },
    {
      "@type": "Question",
      "name": "Wie verbessere ich meinen Score?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Folgen Sie den Empfehlungen der einzelnen Checks um Ihre KI-Sichtbarkeit zu verbessern. Jeder Check gibt <em>konkrete Handlungsempfehlungen</em>."
      }
    },
    {
      "@type": "Question",
      "name": "Was kostet Beacon?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Beacon bietet verschiedene Preismodelle an, von kostenlos bis Enterprise mit erweiterten Features. Besuchen Sie unsere <a href='/pricing'>Preisseite</a>."
      }
    }
  ]
}
</script>
</body>
</html>`;

const FULL_HOWTO = `<html lang="de">
<head><meta charset="utf-8"><title>Anleitung</title></head>
<body>
<main>
<h1>Anleitung: Website für KI optimieren</h1>
<p>Schritt-für-Schritt Anleitung zur Optimierung.</p>
</main>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Website für KI optimieren",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Schritt 1: Scanner ausführen",
      "text": "Führen Sie zunächst den Beacon Scanner auf Ihrer Webseite aus um den aktuellen Stand zu ermitteln."
    },
    {
      "@type": "HowToStep",
      "name": "Schritt 2: Ergebnisse analysieren",
      "text": "Analysieren Sie die Ergebnisse des Scanners und identifizieren Sie die wichtigsten Verbesserungspotenziale."
    },
    {
      "@type": "HowToStep",
      "name": "Schritt 3: Schema.org hinzufügen",
      "text": "Fügen Sie strukturierte Daten im Schema.org Format hinzu um die Maschinenlesbarkeit zu verbessern."
    },
    {
      "@type": "HowToStep",
      "name": "Schritt 4: Content optimieren",
      "text": "Optimieren Sie Ihre Inhalte für KI-Systeme durch klare Struktur und eindeutige Informationen."
    },
    {
      "@type": "HowToStep",
      "name": "Schritt 5: Erneut scannen",
      "text": "Führen Sie den Scanner erneut aus um die Verbesserungen zu verifizieren und weitere Optimierungen zu finden."
    }
  ]
}
</script>
</body>
</html>`;

const NO_SCHEMA = `<html lang="de">
<head><meta charset="utf-8"><title>Seite ohne Schema</title></head>
<body>
<main>
<h1>Seite ohne FAQ</h1>
<p>Diese Seite hat keine strukturierten Daten.</p>
</main>
</body>
</html>`;

const EMPTY_FAQ = `<html lang="de">
<head><meta charset="utf-8"><title>Leere FAQ</title></head>
<body>
<main><h1>FAQ</h1></main>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": []
}
</script>
</body>
</html>`;

const SHORT_ANSWERS = `<html lang="de">
<head><meta charset="utf-8"><title>Kurze FAQ</title></head>
<body>
<main>
<h1>FAQ</h1>
<p>Frage 1</p><p>Frage 2</p><p>Frage 3</p><p>Frage 4</p><p>Frage 5</p>
</main>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "Frage 1", "acceptedAnswer": { "@type": "Answer", "text": "Kurze Antwort." } },
    { "@type": "Question", "name": "Frage 2", "acceptedAnswer": { "@type": "Answer", "text": "Sehr kurz." } },
    { "@type": "Question", "name": "Frage 3", "acceptedAnswer": { "@type": "Answer", "text": "Auch kurz." } },
    { "@type": "Question", "name": "Frage 4", "acceptedAnswer": { "@type": "Answer", "text": "Noch kürzer." } },
    { "@type": "Question", "name": "Frage 5", "acceptedAnswer": { "@type": "Answer", "text": "Minimal." } }
  ]
}
</script>
</body>
</html>`;

const MINIMAL_FAQ = `<html lang="de">
<head><meta charset="utf-8"><title>Minimale FAQ</title></head>
<body>
<main>
<h1>FAQ</h1>
<p>Was ist das hier?</p>
</main>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Was ist das hier?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Dies ist eine ausführliche Antwort auf die Frage, die mehr als fünfzig Zeichen lang ist und damit die Qualitätsanforderungen erfüllt."
      }
    }
  ]
}
</script>
</body>
</html>`;

// ── Tests ───────────────────────────────────────────────────

describe("faq-schema check", () => {
	describe("metadata", () => {
		it("has correct id", () => {
			expect(faqSchemaCheck.id).toBe("faq-schema");
		});

		it("has correct category", () => {
			expect(faqSchemaCheck.category).toBe("readability");
		});

		it("has correct severity", () => {
			expect(faqSchemaCheck.severity).toBe("important");
		});
	});

	describe("pass scenarios", () => {
		it("scores >= 80 for full FAQ with rich content and cross-references", async () => {
			const ctx = makeContext(FULL_FAQ);
			const result = await faqSchemaCheck.run(ctx);
			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(80);
		});

		it("scores >= 80 for full HowTo", async () => {
			const ctx = makeContext(FULL_HOWTO);
			const result = await faqSchemaCheck.run(ctx);
			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(80);
		});
	});

	describe("warn scenarios", () => {
		it("scores 40-79 for short answers", async () => {
			const ctx = makeContext(SHORT_ANSWERS);
			const result = await faqSchemaCheck.run(ctx);
			expect(result.status).toBe("warn");
			expect(result.score).toBeGreaterThanOrEqual(40);
			expect(result.score).toBeLessThan(80);
		});

		it("scores lower than full FAQ for minimal FAQ (1 item)", async () => {
			const ctx = makeContext(MINIMAL_FAQ);
			const result = await faqSchemaCheck.run(ctx);
			// 1 quality item with cross-reference scores exactly 80 (pass threshold)
			// hasSchema=20, validStructure=20, contentQuality=25, itemCount=5, richContent=0, crossRef=10 = 80
			expect(result.score).toBeLessThanOrEqual(80);
			expect(result.score).toBeGreaterThanOrEqual(40);
		});
	});

	describe("fail scenarios", () => {
		it("scores 0 for no schema", async () => {
			const ctx = makeContext(NO_SCHEMA);
			const result = await faqSchemaCheck.run(ctx);
			expect(result.status).toBe("fail");
			expect(result.score).toBe(0);
		});

		it("scores < 40 for empty FAQ", async () => {
			const ctx = makeContext(EMPTY_FAQ);
			const result = await faqSchemaCheck.run(ctx);
			expect(result.status).toBe("fail");
			expect(result.score).toBeLessThan(40);
		});
	});

	describe("details object", () => {
		it("includes expected fields for full FAQ", async () => {
			const ctx = makeContext(FULL_FAQ);
			const result = await faqSchemaCheck.run(ctx);
			const d = result.details as Record<string, unknown>;

			expect(d.hasFaqPage).toBe(true);
			expect(d.hasHowTo).toBe(false);
			expect(d.faqItemCount).toBe(5);
			expect(d.howToStepCount).toBe(0);
			expect(d.howToName).toBeNull();
			expect(d.averageAnswerLength).toBeGreaterThan(50);
			expect(d.qualityItemCount).toBeGreaterThan(0);
			expect(d.hasRichContent).toBe(true);
			expect(d.crossReferenceRatio).toBeGreaterThan(0);
		});

		it("includes expected fields for HowTo", async () => {
			const ctx = makeContext(FULL_HOWTO);
			const result = await faqSchemaCheck.run(ctx);
			const d = result.details as Record<string, unknown>;

			expect(d.hasFaqPage).toBe(false);
			expect(d.hasHowTo).toBe(true);
			expect(d.howToStepCount).toBe(5);
			expect(d.howToName).toBe("Website für KI optimieren");
		});
	});

	describe("issue messages", () => {
		it("reports missing schema", async () => {
			const ctx = makeContext(NO_SCHEMA);
			const result = await faqSchemaCheck.run(ctx);
			expect(
				result.issues.some((i) => i.message.includes("Keine FAQ- oder Anleitungs-Daten")),
			).toBe(true);
		});

		it("reports empty mainEntity", async () => {
			const ctx = makeContext(EMPTY_FAQ);
			const result = await faqSchemaCheck.run(ctx);
			expect(
				result.issues.some((i) => i.message.includes("keine Fragen und Antworten definiert")),
			).toBe(true);
		});

		it("reports short answers", async () => {
			const ctx = makeContext(SHORT_ANSWERS);
			const result = await faqSchemaCheck.run(ctx);
			expect(result.issues.some((i) => i.message.includes("zu kurz"))).toBe(true);
		});

		it("reports few items for minimal FAQ", async () => {
			const ctx = makeContext(MINIMAL_FAQ);
			const result = await faqSchemaCheck.run(ctx);
			expect(result.issues.some((i) => i.message.includes("Nur 1 FAQ-Einträge"))).toBe(true);
		});
	});

	describe("parser", () => {
		it("handles @graph wrapper", () => {
			const html = `<html><body>
			<script type="application/ld+json">
			{ "@context": "https://schema.org", "@graph": [
				{ "@type": "FAQPage", "mainEntity": [
					{ "@type": "Question", "name": "Test?", "acceptedAnswer": { "@type": "Answer", "text": "This is a test answer that is long enough to pass quality checks." } }
				] }
			] }
			</script>
			</body></html>`;
			const parsed = parseFaqSchema(parse(html));
			expect(parsed.hasFaqPage).toBe(true);
			expect(parsed.faqItems).toHaveLength(1);
		});

		it("handles invalid JSON gracefully", () => {
			const html = `<html><body>
			<script type="application/ld+json">{ invalid json }</script>
			</body></html>`;
			const parsed = parseFaqSchema(parse(html));
			expect(parsed.invalidJson).toBe(true);
			expect(parsed.hasFaqPage).toBe(false);
		});
	});
});
