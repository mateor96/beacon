import type { CheckContext } from "@beacon/shared";
import { parse } from "node-html-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
	default: contentFreshnessCheck,
	parseContentFreshness,
	calculateScore,
} = await import("../../checks/content-freshness.js");

// ── Time control ────────────────────────────────────────────

beforeEach(() => {
	vi.useFakeTimers({ now: new Date("2026-03-29T12:00:00Z") });
});

afterEach(() => {
	vi.useRealTimers();
});

// ── Helpers ─────────────────────────────────────────────────

const NOW = new Date("2026-03-29T12:00:00Z");

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

// Published 2 months ago, modified 1 week ago, all 3 channels
const FRESH_ARTICLE = `<html lang="de">
<head>
<meta charset="utf-8">
<title>Aktueller Artikel</title>
<meta property="article:published_time" content="2026-01-29T10:00:00Z">
<meta property="article:modified_time" content="2026-03-22T10:00:00Z">
</head>
<body>
<main>
<article>
<h1>Aktueller Artikel</h1>
<time datetime="2026-01-29">29. Januar 2026</time>
<p>Aktueller Inhalt mit relevanten Informationen.</p>
</article>
</main>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Aktueller Artikel",
  "datePublished": "2026-01-29",
  "dateModified": "2026-03-22"
}
</script>
</body>
</html>`;

// Published and modified 6 years ago (2020)
const OLD_ARTICLE = `<html lang="de">
<head>
<meta charset="utf-8">
<title>Alter Artikel</title>
<meta property="article:published_time" content="2020-03-15T10:00:00Z">
<meta property="article:modified_time" content="2020-06-01T10:00:00Z">
</head>
<body>
<main>
<article>
<h1>Alter Artikel</h1>
<time datetime="2020-03-15">15. M\u00e4rz 2020</time>
<p>Veralteter Inhalt.</p>
</article>
</main>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "datePublished": "2020-03-15",
  "dateModified": "2020-06-01"
}
</script>
</body>
</html>`;

// No date signals at all
const NO_DATES = `<html lang="de">
<head>
<meta charset="utf-8">
<title>Seite ohne Datum</title>
</head>
<body>
<main>
<p>Inhalt ohne jegliche Datumsangaben.</p>
</main>
</body>
</html>`;

// Dates only in JSON-LD, recent
const SCHEMA_ONLY = `<html lang="de">
<head>
<meta charset="utf-8">
<title>Nur Schema-Daten</title>
</head>
<body>
<main>
<article>
<h1>Artikel mit Schema-Daten</h1>
<p>Inhalt ohne sichtbare Daten.</p>
</article>
</main>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "datePublished": "2026-02-15",
  "dateModified": "2026-03-20"
}
</script>
</body>
</html>`;

// Old publish (2023) but recently modified
const RECENTLY_MODIFIED = `<html lang="de">
<head>
<meta charset="utf-8">
<title>K\u00fcrzlich aktualisiert</title>
<meta property="article:published_time" content="2023-06-01T10:00:00Z">
<meta property="article:modified_time" content="2026-03-15T10:00:00Z">
</head>
<body>
<main>
<article>
<h1>Aktualisierter Artikel</h1>
<time datetime="2023-06-01">1. Juni 2023</time>
<p>Inhalt mit aktueller Aktualisierung.</p>
</article>
</main>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "datePublished": "2023-06-01",
  "dateModified": "2026-03-15"
}
</script>
</body>
</html>`;

// Future dates (2027)
const FUTURE_DATE = `<html lang="de">
<head>
<meta charset="utf-8">
<title>Zukunftsdatum</title>
<meta property="article:published_time" content="2027-06-01T10:00:00Z">
</head>
<body>
<main>
<article>
<h1>Zukunftsartikel</h1>
<time datetime="2027-06-01">1. Juni 2027</time>
<p>Inhalt mit Datum in der Zukunft.</p>
</article>
</main>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "datePublished": "2027-06-01"
}
</script>
</body>
</html>`;

// ── Tests ───────────────────────────────────────────────────

describe("content-freshness check", () => {
	describe("metadata", () => {
		it("has correct id, category, and severity", () => {
			expect(contentFreshnessCheck.id).toBe("content-freshness");
			expect(contentFreshnessCheck.category).toBe("readability");
			expect(contentFreshnessCheck.severity).toBe("important");
		});
	});

	describe("pass scenarios", () => {
		it("FRESH_ARTICLE scores >= 80 (pass)", async () => {
			const ctx = makeContext(FRESH_ARTICLE);
			const result = await contentFreshnessCheck.run(ctx);
			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(80);
		});
	});

	describe("warn scenarios", () => {
		it("OLD_ARTICLE scores in warn range", async () => {
			const ctx = makeContext(OLD_ARTICLE);
			const result = await contentFreshnessCheck.run(ctx);
			expect(result.score).toBeGreaterThanOrEqual(30);
			expect(result.score).toBeLessThanOrEqual(60);
		});

		it("SCHEMA_ONLY scores in warn range (55-75)", async () => {
			const ctx = makeContext(SCHEMA_ONLY);
			const result = await contentFreshnessCheck.run(ctx);
			expect(result.status).toBe("warn");
			expect(result.score).toBeGreaterThanOrEqual(55);
			expect(result.score).toBeLessThanOrEqual(75);
		});

		it("RECENTLY_MODIFIED scores pass due to recent modification across all channels", async () => {
			const ctx = makeContext(RECENTLY_MODIFIED);
			const result = await contentFreshnessCheck.run(ctx);
			expect(result.score).toBeGreaterThanOrEqual(80);
			expect(result.status).toBe("pass");
		});
	});

	describe("fail scenarios", () => {
		it("NO_DATES scores < 30 (fail)", async () => {
			const ctx = makeContext(NO_DATES);
			const result = await contentFreshnessCheck.run(ctx);
			expect(result.status).toBe("fail");
			expect(result.score).toBeLessThan(30);
		});
	});

	describe("edge cases", () => {
		it("FUTURE_DATE is penalized", async () => {
			const ctx = makeContext(FUTURE_DATE);
			const result = await contentFreshnessCheck.run(ctx);
			const futureIssue = result.issues.find((i) => i.message.includes("Zukunft"));
			expect(futureIssue).toBeDefined();
			expect(futureIssue?.severity).toBe("critical");
		});
	});

	describe("details object", () => {
		it("contains expected fields for FRESH_ARTICLE", async () => {
			const ctx = makeContext(FRESH_ARTICLE);
			const result = await contentFreshnessCheck.run(ctx);
			expect(result.details).toBeDefined();
			expect(result.details?.jsonLdDatePublished).toBe("2026-01-29");
			expect(result.details?.jsonLdDateModified).toBe("2026-03-22");
			expect(result.details?.metaPublishedTime).toBe("2026-01-29T10:00:00Z");
			expect(result.details?.metaModifiedTime).toBe("2026-03-22T10:00:00Z");
			expect(result.details?.totalChannels).toBe(3);
			expect(result.details?.hasFutureDate).toBe(false);
		});

		it("contains null fields for NO_DATES", async () => {
			const ctx = makeContext(NO_DATES);
			const result = await contentFreshnessCheck.run(ctx);
			expect(result.details).toBeDefined();
			expect(result.details?.jsonLdDatePublished).toBeNull();
			expect(result.details?.mostRecentDate).toBeNull();
			expect(result.details?.totalChannels).toBe(0);
		});
	});

	describe("parseContentFreshness", () => {
		it("extracts all date sources from FRESH_ARTICLE", () => {
			const parsed = parseContentFreshness(parse(FRESH_ARTICLE), NOW);
			expect(parsed.jsonLdDatePublished).toBe("2026-01-29");
			expect(parsed.jsonLdDateModified).toBe("2026-03-22");
			expect(parsed.metaPublishedTime).toBe("2026-01-29T10:00:00Z");
			expect(parsed.metaModifiedTime).toBe("2026-03-22T10:00:00Z");
			expect(parsed.visibleTimeElements).toHaveLength(1);
			expect(parsed.totalChannels).toBe(3);
			expect(parsed.hasFutureDate).toBe(false);
		});

		it("detects future dates", () => {
			const parsed = parseContentFreshness(parse(FUTURE_DATE), NOW);
			expect(parsed.hasFutureDate).toBe(true);
		});
	});

	describe("calculateScore", () => {
		it("returns 0 score and critical issue for NO_DATES", () => {
			const parsed = parseContentFreshness(parse(NO_DATES), NOW);
			const result = calculateScore(parsed, NOW);
			expect(result.score).toBe(0);
			const criticalIssue = result.issues.find((i) => i.severity === "critical");
			expect(criticalIssue).toBeDefined();
		});
	});
});
