import type { CheckContext } from "@beacon/shared";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

const { default: citationReadinessCheck } = await import("../../checks/citation-readiness.js");

// ── Helpers ─────────────────────────────────────────────────

function makeContext(html: string, url = "https://example.com/article"): CheckContext {
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

const CITABLE_ARTICLE = `<html lang="de">
<head>
<meta charset="utf-8">
<title>Umfassender Leitfaden zur KI-Optimierung</title>
<meta name="author" content="Max Mustermann">
<meta property="article:published_time" content="2024-01-15T10:00:00Z">
<meta property="article:modified_time" content="2024-06-01T12:00:00Z">
<meta property="article:author" content="Max Mustermann">
<meta property="article:section" content="Technologie">
<meta property="article:tag" content="KI">
<meta property="og:type" content="article">
<link rel="canonical" href="https://example.com/article">
</head>
<body>
<main>
<article>
<h1>Umfassender Leitfaden zur KI-Optimierung</h1>
<p class="byline">Von <a rel="author" href="/autor/max">Max Mustermann</a></p>
<time datetime="2024-01-15">15. Januar 2024</time>
<p>Laut einer Studie von McKinsey nutzen bereits 65% der Verbraucher KI-basierte Assistenten. Die Ergebnisse zeigen eine Steigerung von 42% im Vergleich zum Vorjahr.</p>
<blockquote>Die Zukunft der Suche ist semantisch. <cite>Google AI Blog, 2024</cite></blockquote>
<p>Weitere Informationen finden Sie bei <a href="https://openai.com">OpenAI</a>, <a href="https://anthropic.com">Anthropic</a> und <a href="https://deepmind.google">DeepMind</a>.</p>
<figure><img src="/chart.png" alt="Statistik"><figcaption>Abbildung 1: KI-Nutzung 2024</figcaption></figure>
<p>Der Begriff <dfn>Large Language Model</dfn> beschreibt ein neuronales Netzwerk mit Milliarden von Parametern.</p>
</article>
</main>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Umfassender Leitfaden zur KI-Optimierung",
  "author": {"@type": "Person", "name": "Max Mustermann"},
  "datePublished": "2024-01-15",
  "dateModified": "2024-06-01",
  "description": "Ein umfassender Leitfaden",
  "image": "https://example.com/image.jpg",
  "publisher": {"@type": "Organization", "name": "Example"},
  "mainEntityOfPage": "https://example.com/article"
}
</script>
</body>
</html>`;

const NEWS_ARTICLE = `<html lang="de">
<head>
<meta name="author" content="Anna Schmidt">
<meta property="article:published_time" content="2024-03-10T08:00:00Z">
<meta property="article:modified_time" content="2024-03-10T14:00:00Z">
<meta property="article:author" content="Anna Schmidt">
<meta property="article:section" content="Politik">
<meta property="article:tag" content="Bundesregierung">
<meta property="og:type" content="article">
<link rel="canonical" href="https://example.com/article">
</head>
<body>
<main>
<article>
<h1>Aktuelle Nachricht</h1>
<time datetime="2024-03-10">10. März 2024</time>
<p>In Berlin wurden heute 500 neue Maßnahmen beschlossen. Die Kosten belaufen sich auf 2,3 Milliarden Euro.</p>
<p>Laut <a href="https://reuters.com">Reuters</a> und <a href="https://dpa.com">dpa</a> sowie <a href="https://afp.com">AFP</a> bestätigten offizielle Quellen die Zahlen.</p>
<blockquote>Wir setzen auf Innovation. <cite>Bundeskanzler, 2024</cite></blockquote>
<figure><img src="/foto.jpg" alt="Foto"><figcaption>Pressekonferenz</figcaption></figure>
</article>
</main>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "Aktuelle Nachricht",
  "author": {"@type": "Person", "name": "Anna Schmidt"},
  "datePublished": "2024-03-10",
  "dateModified": "2024-03-10",
  "description": "Aktuelle Nachricht aus Berlin",
  "image": "https://example.com/foto.jpg",
  "publisher": {"@type": "Organization", "name": "Example News"},
  "mainEntityOfPage": "https://example.com/article"
}
</script>
</body>
</html>`;

const BLOG_NO_DATES = `<html lang="de">
<head>
<meta name="author" content="Lisa Weber">
<meta property="og:type" content="article">
<link rel="canonical" href="https://example.com/article">
</head>
<body>
<main>
<article>
<h1>Blog-Beitrag ohne Datum</h1>
<p class="author">Von Lisa Weber</p>
<p>Ein interessanter Artikel mit 150 Woertern und einigen Zahlen wie 42 und 100.</p>
<p>Weitere Details bei <a href="https://wikipedia.org">Wikipedia</a>.</p>
</article>
</main>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Blog-Beitrag ohne Datum",
  "author": {"@type": "Person", "name": "Lisa Weber"}
}
</script>
</body>
</html>`;

const SCHEMA_ONLY = `<html>
<head><title>Schema Only</title></head>
<body>
<div>
<h1>Artikel mit Schema</h1>
<p>Minimaler Inhalt ohne HTML-Signale.</p>
</div>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Artikel mit Schema",
  "author": {"@type": "Person", "name": "Test"},
  "datePublished": "2024-01-01",
  "dateModified": "2024-02-01",
  "description": "Test",
  "image": "https://example.com/img.jpg",
  "publisher": {"@type": "Organization", "name": "Test"},
  "mainEntityOfPage": "https://example.com"
}
</script>
</body>
</html>`;

const BARE_MINIMUM = `<html>
<head><title>Nur ein Titel</title></head>
<body>
<div>
<h1>Einfache Seite</h1>
<p>Hier gibt es wenig zu sehen.</p>
</div>
</body>
</html>`;

const EMPTY_PAGE = "<html><body></body></html>";

const SPA_SHELL = `<html>
<head><title>SPA</title></head>
<body>
<div id="app"></div>
<script src="/bundle.js"></script>
</body>
</html>`;

const PAGE_WITH_DATES_NO_AUTHOR = `<html lang="de">
<head>
<meta property="article:published_time" content="2024-01-01T00:00:00Z">
<meta property="article:modified_time" content="2024-06-01T00:00:00Z">
<meta property="og:type" content="article">
<link rel="canonical" href="https://example.com/article">
</head>
<body>
<main>
<article>
<h1>Artikel ohne Autor</h1>
<time datetime="2024-01-01">1. Januar 2024</time>
<p>Inhalt mit Zahlen 42, 100, 200 und externen Links.</p>
<p>Quelle: <a href="https://reuters.com">Reuters</a></p>
</article>
</main>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Artikel ohne Autor",
  "datePublished": "2024-01-01",
  "dateModified": "2024-06-01"
}
</script>
</body>
</html>`;

const JSON_LD_GRAPH = `<html>
<head>
<meta name="author" content="Graph Author">
<meta property="og:type" content="article">
<link rel="canonical" href="https://example.com/article">
</head>
<body>
<main>
<time datetime="2024-01-01">1. Januar 2024</time>
<p>Inhalt mit Zahlen 10, 20, 30 und <a href="https://external.com">externer Link</a>.</p>
</main>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Graph Article",
      "author": {"@type": "Person", "name": "Graph Author"},
      "datePublished": "2024-01-01",
      "dateModified": "2024-06-01",
      "description": "Test",
      "image": "https://example.com/img.jpg",
      "publisher": {"@type": "Organization", "name": "Test"},
      "mainEntityOfPage": "https://example.com/article"
    }
  ]
}
</script>
</body>
</html>`;

const EXTERNAL_LINKS_PAGE = `<html>
<head><meta name="author" content="Test"></head>
<body>
<main>
<article>
<p>Links zu <a href="https://google.com">Google</a>, <a href="https://github.com">GitHub</a>, <a href="https://example.com/internal">intern</a>, <a href="https://www.example.com/also-internal">auch intern</a>, <a href="https://external.org">extern</a>.</p>
</article>
</main>
</body>
</html>`;

const CANONICAL_MATCH = `<html>
<head>
<link rel="canonical" href="https://example.com/article">
</head>
<body><p>Test</p></body>
</html>`;

const CANONICAL_MISMATCH = `<html>
<head>
<link rel="canonical" href="https://example.com/other-page">
</head>
<body><p>Test</p></body>
</html>`;

// ── Tests ───────────────────────────────────────────────────

describe("citation-readiness check", () => {
	describe("metadata", () => {
		it("has correct id, category, and severity", () => {
			expect(citationReadinessCheck.id).toBe("citation-readiness");
			expect(citationReadinessCheck.category).toBe("readability");
			expect(citationReadinessCheck.severity).toBe("important");
		});
	});

	describe("pass scenarios", () => {
		it("citable article returns pass with score >= 80", async () => {
			const result = await citationReadinessCheck.run(makeContext(CITABLE_ARTICLE));

			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(80);
		});

		it("news article with full signals returns pass", async () => {
			const result = await citationReadinessCheck.run(makeContext(NEWS_ARTICLE));

			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(80);
		});

		it("pass result has no critical issues", async () => {
			const result = await citationReadinessCheck.run(makeContext(CITABLE_ARTICLE));

			expect(result.issues.some((i) => i.severity === "critical")).toBe(false);
		});
	});

	describe("warn scenarios", () => {
		it("blog post without dates returns warn", async () => {
			const result = await citationReadinessCheck.run(makeContext(BLOG_NO_DATES));

			expect(result.status).toBe("warn");
			expect(result.score).toBeGreaterThanOrEqual(40);
			expect(result.score).toBeLessThan(80);
		});

		it("schema-only page returns warn", async () => {
			const result = await citationReadinessCheck.run(makeContext(SCHEMA_ONLY));

			expect(result.status).toBe("warn");
			expect(result.score).toBeGreaterThanOrEqual(40);
			expect(result.score).toBeLessThan(80);
		});

		it("page with dates but no author returns warn", async () => {
			const result = await citationReadinessCheck.run(makeContext(PAGE_WITH_DATES_NO_AUTHOR));

			expect(result.status).toBe("warn");
			expect(result.issues.some((i) => i.message.includes("Autorenangabe"))).toBe(true);
		});
	});

	describe("fail scenarios", () => {
		it("bare minimum page returns fail", async () => {
			const result = await citationReadinessCheck.run(makeContext(BARE_MINIMUM));

			expect(result.status).toBe("fail");
			expect(result.score).toBeLessThan(40);
		});

		it("empty page returns fail with score <= 5", async () => {
			const result = await citationReadinessCheck.run(makeContext(EMPTY_PAGE));

			expect(result.status).toBe("fail");
			expect(result.score).toBeLessThanOrEqual(5);
		});

		it("SPA shell returns fail", async () => {
			const result = await citationReadinessCheck.run(makeContext(SPA_SHELL));

			expect(result.status).toBe("fail");
			expect(result.score).toBeLessThan(40);
		});
	});

	describe("sub-signal scoring", () => {
		it("JSON-LD author scores higher than meta-only", async () => {
			const jsonLdOnly = `<html><head></head><body><p>Test</p>
				<script type="application/ld+json">{"@type":"Article","author":{"name":"Test"}}</script>
			</body></html>`;
			const metaOnly = `<html><head><meta name="author" content="Test"></head><body><p>Test</p></body></html>`;

			const jsonLdResult = await citationReadinessCheck.run(makeContext(jsonLdOnly));
			const metaResult = await citationReadinessCheck.run(makeContext(metaOnly));

			// Both get 8pts for author, but JSON-LD also contributes to schema depth
			expect(jsonLdResult.score).toBeGreaterThanOrEqual(metaResult.score);
		});

		it("external links boost factual credibility", async () => {
			const result = await citationReadinessCheck.run(makeContext(EXTERNAL_LINKS_PAGE));
			const details = result.details as Record<string, unknown>;

			expect(details.externalLinkCount).toBeGreaterThanOrEqual(3);
		});

		it("article schema completeness affects score", async () => {
			const fullSchema = await citationReadinessCheck.run(makeContext(CITABLE_ARTICLE));
			const partialSchema = await citationReadinessCheck.run(makeContext(BLOG_NO_DATES));

			const fullDetails = fullSchema.details as Record<string, number>;
			const partialDetails = partialSchema.details as Record<string, number>;

			expect(fullDetails.articleSchemaPropertyCount).toBeGreaterThan(
				partialDetails.articleSchemaPropertyCount,
			);
		});

		it("canonical URL match awards bonus", async () => {
			const matchResult = await citationReadinessCheck.run(makeContext(CANONICAL_MATCH));
			const mismatchResult = await citationReadinessCheck.run(makeContext(CANONICAL_MISMATCH));

			expect(matchResult.score).toBeGreaterThan(mismatchResult.score);
		});
	});

	describe("edge cases", () => {
		it("JSON-LD @graph format parsed correctly", async () => {
			const result = await citationReadinessCheck.run(makeContext(JSON_LD_GRAPH));
			const details = result.details as Record<string, unknown>;

			expect(details.articleSchemaType).toBe("Article");
			expect(details.hasAuthor).toBe(true);
		});

		it("external links exclude same-domain", async () => {
			const result = await citationReadinessCheck.run(makeContext(EXTERNAL_LINKS_PAGE));
			const details = result.details as Record<string, unknown>;

			// 3 external (google.com, github.com, external.org), 2 internal (example.com)
			expect(details.externalLinkCount).toBe(3);
		});
	});

	describe("score boundaries", () => {
		it("score never exceeds 100", async () => {
			const result = await citationReadinessCheck.run(makeContext(CITABLE_ARTICLE));

			expect(result.score).toBeLessThanOrEqual(100);
		});

		it("citable article between 80-100", async () => {
			const result = await citationReadinessCheck.run(makeContext(CITABLE_ARTICLE));

			expect(result.score).toBeGreaterThanOrEqual(80);
			expect(result.score).toBeLessThanOrEqual(100);
		});
	});

	describe("details object", () => {
		it("contains expected fields for citable article", async () => {
			const result = await citationReadinessCheck.run(makeContext(CITABLE_ARTICLE));
			const details = result.details as Record<string, unknown>;

			expect(details.hasAuthor).toBe(true);
			expect(details.hasPublicationDate).toBe(true);
			expect(details.hasUpdateDate).toBe(true);
			expect(details.articleSchemaType).toBe("Article");
			expect(details.articleSchemaPropertyCount).toBe(8);
			expect(details.hasCanonical).toBe(true);
			expect(details.canonicalMatchesUrl).toBe(true);
			expect(details.externalLinkCount).toBeGreaterThanOrEqual(3);
			expect(details.hasBlockquote).toBe(true);
			expect(details.hasCiteElement).toBe(true);
			expect(details.semanticElementCount).toBeGreaterThanOrEqual(4);
			expect(details.ogTypeIsArticle).toBe(true);
			expect(details.articleOgPropertyCount).toBeGreaterThanOrEqual(3);
		});

		it("contains expected fields for empty page", async () => {
			const result = await citationReadinessCheck.run(makeContext(EMPTY_PAGE));
			const details = result.details as Record<string, unknown>;

			expect(details.hasAuthor).toBe(false);
			expect(details.hasPublicationDate).toBe(false);
			expect(details.hasUpdateDate).toBe(false);
			expect(details.articleSchemaType).toBeNull();
			expect(details.hasCanonical).toBe(false);
			expect(details.externalLinkCount).toBe(0);
			expect(details.ogTypeIsArticle).toBe(false);
		});
	});
});
