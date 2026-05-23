import type { CheckContext } from "@beacon/shared";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

// No fetchUrl mock needed — this check reads from ctx.parsedHtml directly
const { default: metaTagsCheck } = await import("../../checks/meta-tags.js");

// ── Helpers ─────────────────────────────────────────────────

function makeContext(html: string): CheckContext {
	return {
		inputUrl: "https://example.com",
		finalUrl: "https://example.com",
		html,
		parsedHtml: parse(html),
		responseTime: 100,
		statusCode: 200,
		redirects: [],
		subResources: {},
	};
}

// ── Fixtures ────────────────────────────────────────────────

const EXCELLENT_HTML = `<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Acme Corp - Cloud Loesungen für den Mittelstand</title>
  <meta name="description" content="Acme Corp bietet fuehrende Cloud-Infrastruktur und DevOps-Loesungen für mittelständische Unternehmen in der DACH-Region.">
  <link rel="canonical" href="https://acme.com/">
  <meta property="og:title" content="Acme Corp - Cloud Loesungen">
  <meta property="og:description" content="Fuehrende Cloud-Infrastruktur für den Mittelstand">
  <meta property="og:image" content="https://acme.com/og-image.png">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://acme.com/">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Acme Corp">
  <meta name="twitter:description" content="Cloud-Loesungen für den Mittelstand">
</head>
<body><h1>Willkommen</h1></body>
</html>`;

const EMPTY_HTML = "<html><head></head><body></body></html>";

const TITLE_ONLY_HTML = "<html><head><title>Acme Corp Website</title></head><body></body></html>";

const TITLE_DESC_HTML = `<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Acme Corp - Cloud Loesungen</title>
  <meta name="description" content="Acme Corp bietet Cloud-Infrastruktur und DevOps-Loesungen für Unternehmen in der DACH-Region.">
</head>
<body></body>
</html>`;

const FULL_OG_NO_TWITTER_HTML = `<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Acme Corp - Cloud Loesungen für den Mittelstand</title>
  <meta name="description" content="Acme Corp bietet fuehrende Cloud-Infrastruktur und DevOps-Loesungen für mittelständische Unternehmen in der DACH-Region.">
  <link rel="canonical" href="https://acme.com/">
  <meta property="og:title" content="Acme Corp - Cloud Loesungen">
  <meta property="og:description" content="Fuehrende Cloud-Infrastruktur für den Mittelstand">
  <meta property="og:image" content="https://acme.com/og-image.png">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://acme.com/">
</head>
<body><h1>Willkommen</h1></body>
</html>`;

const EMPTY_TITLE_HTML = "<html><head><title></title></head><body></body></html>";

const LONG_TITLE_HTML =
	"<html><head><title>Dies ist ein extrem langer Titel der weit über sechzig Zeichen hinausgeht und abgeschnitten wird</title></head><body></body></html>";

const SHORT_DESC_HTML = `<html><head>
  <title>Acme Corp Website</title>
  <meta name="description" content="Kurze Beschreibung.">
</head><body></body></html>`;

const LONG_DESC_HTML = `<html><head>
  <title>Acme Corp Website</title>
  <meta name="description" content="Dies ist eine extrem lange Meta-Description die weit über hundertsechzig Zeichen hinausgeht und von Suchmaschinen abgeschnitten werden würde. Sie enthaelt viel zu viele Informationen und sollte gekuerzt werden um optimal dargestellt zu werden.">
</head><body></body></html>`;

const DUPLICATE_DESC_HTML = `<html><head>
  <title>Acme Corp Website</title>
  <meta name="description" content="Erste Beschreibung die lang genug ist für eine valide Meta Description hier.">
  <meta name="description" content="Zweite Beschreibung die lang genug ist für eine valide Meta Description hier.">
</head><body></body></html>`;

const OG_IMAGE_ONLY_HTML = `<html><head>
  <title>Acme Corp Website</title>
  <meta name="description" content="Acme Corp bietet Cloud-Loesungen für mittelständische Unternehmen in der DACH-Region.">
  <meta property="og:image" content="https://acme.com/og.png">
</head><body></body></html>`;

const TWITTER_NO_OG_HTML = `<html><head>
  <title>Acme Corp Website</title>
  <meta name="description" content="Acme Corp bietet Cloud-Loesungen für mittelständische Unternehmen in der DACH-Region.">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Acme Corp">
  <meta name="twitter:description" content="Cloud-Loesungen">
</head><body></body></html>`;

const CANONICAL_HTML = `<html><head>
  <title>Acme Corp Website</title>
  <meta name="description" content="Acme Corp bietet Cloud-Loesungen für mittelständische Unternehmen in der DACH-Region.">
  <link rel="canonical" href="https://acme.com/">
</head><body></body></html>`;

const LANG_HTML = `<html lang="en"><head>
  <title>Acme Corp Website</title>
  <meta name="description" content="Acme Corp bietet Cloud-Loesungen für mittelständische Unternehmen in der DACH-Region.">
</head><body></body></html>`;

const NOINDEX_HTML = `<html><head>
  <title>Acme Corp Website</title>
  <meta name="description" content="Acme Corp bietet Cloud-Loesungen für mittelständische Unternehmen in der DACH-Region.">
  <meta name="robots" content="noindex, nofollow">
</head><body></body></html>`;

// ── Tests ───────────────────────────────────────────────────

describe("meta-tags check", () => {
	describe("metadata", () => {
		it("has correct id, category, and severity", () => {
			expect(metaTagsCheck.id).toBe("meta-tags");
			expect(metaTagsCheck.category).toBe("readability");
			expect(metaTagsCheck.severity).toBe("important");
		});
	});

	describe("excellent page", () => {
		it("returns pass with score >= 90 and no critical issues", async () => {
			const result = await metaTagsCheck.run(makeContext(EXCELLENT_HTML));

			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(90);
			expect(
				result.issues.every((i) => i.severity === "nice-to-have" || i.severity === "important"),
			).toBe(true);
		});
	});

	describe("empty page", () => {
		it("returns fail with score 0 and multiple issues", async () => {
			const result = await metaTagsCheck.run(makeContext(EMPTY_HTML));

			expect(result.status).toBe("fail");
			expect(result.score).toBe(0);
			expect(result.issues.length).toBeGreaterThanOrEqual(3);
			expect(result.issues.some((i) => i.severity === "critical")).toBe(true);
		});
	});

	describe("title only", () => {
		it("returns fail with score < 40 and issues for missing description and OG", async () => {
			const result = await metaTagsCheck.run(makeContext(TITLE_ONLY_HTML));

			expect(result.status).toBe("fail");
			expect(result.score).toBeLessThan(40);
			expect(
				result.issues.some(
					(i) =>
						i.message.toLowerCase().includes("seitenbeschreibung") ||
						i.message.toLowerCase().includes("beschreibung"),
				),
			).toBe(true);
			expect(
				result.issues.some(
					(i) =>
						i.message.toLowerCase().includes("social-media") ||
						i.message.toLowerCase().includes("og:"),
				),
			).toBe(true);
		});
	});

	describe("title + description", () => {
		it("returns warn with score between 40 and 80", async () => {
			const result = await metaTagsCheck.run(makeContext(TITLE_DESC_HTML));

			expect(result.status).toBe("warn");
			expect(result.score).toBeGreaterThanOrEqual(40);
			expect(result.score).toBeLessThanOrEqual(80);
			expect(
				result.issues.some(
					(i) =>
						i.message.toLowerCase().includes("social-media") ||
						i.message.toLowerCase().includes("og:"),
				),
			).toBe(true);
		});
	});

	describe("full OG tags without Twitter", () => {
		it("returns pass with score >= 80", async () => {
			const result = await metaTagsCheck.run(makeContext(FULL_OG_NO_TWITTER_HTML));

			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(80);
		});
	});

	describe("edge cases", () => {
		it("handles empty title tag", async () => {
			const result = await metaTagsCheck.run(makeContext(EMPTY_TITLE_HTML));

			expect(result.score).toBeLessThan(40);
			expect(
				result.issues.some(
					(i) =>
						i.message.toLowerCase().includes("title") || i.message.toLowerCase().includes("titel"),
				),
			).toBe(true);
		});

		it("handles too-long title (>60 chars) with partial points", async () => {
			const result = await metaTagsCheck.run(makeContext(LONG_TITLE_HTML));

			// Should get partial title points (10 instead of 15)
			expect(
				result.issues.some(
					(i) =>
						i.severity === "nice-to-have" &&
						(i.message.toLowerCase().includes("title") ||
							i.message.toLowerCase().includes("titel")),
				),
			).toBe(true);
		});

		it("handles too-short description (<50 chars) with partial points", async () => {
			const result = await metaTagsCheck.run(makeContext(SHORT_DESC_HTML));

			expect(
				result.issues.some(
					(i) =>
						i.severity === "nice-to-have" && i.message.toLowerCase().includes("seitenbeschreibung"),
				),
			).toBe(true);
		});

		it("handles too-long description (>160 chars) with partial points", async () => {
			const result = await metaTagsCheck.run(makeContext(LONG_DESC_HTML));

			expect(
				result.issues.some(
					(i) =>
						i.severity === "nice-to-have" && i.message.toLowerCase().includes("seitenbeschreibung"),
				),
			).toBe(true);
		});

		it("detects duplicate description tags", async () => {
			const result = await metaTagsCheck.run(makeContext(DUPLICATE_DESC_HTML));

			expect(
				result.issues.some(
					(i) =>
						i.severity === "important" && i.message.toLowerCase().includes("seitenbeschreibungen"),
				),
			).toBe(true);
		});

		it("awards partial OG points for og:image without og:title", async () => {
			const result = await metaTagsCheck.run(makeContext(OG_IMAGE_ONLY_HTML));

			const details = result.details as Record<string, unknown>;
			const ogTags = details.ogTagsPresent as string[];
			expect(ogTags).toContain("og:image");
			expect(ogTags).not.toContain("og:title");
		});

		it("scores title + description without OG tags", async () => {
			const result = await metaTagsCheck.run(makeContext(TWITTER_NO_OG_HTML));

			expect(result.status).toBe("warn");
			// Title(17, short) + Desc(25) + noIssues(10) = 52, no OG basic points
			expect(result.score).toBeGreaterThan(30);
		});

		it("detects canonical URL", async () => {
			const result = await metaTagsCheck.run(makeContext(CANONICAL_HTML));

			const details = result.details as Record<string, unknown>;
			expect(details.hasCanonical).toBe(true);
		});

		it("detects html lang attribute", async () => {
			const result = await metaTagsCheck.run(makeContext(LANG_HTML));

			const details = result.details as Record<string, unknown>;
			expect(details.htmlLang).toBe("en");
		});

		it("detects meta robots noindex with critical issue", async () => {
			const result = await metaTagsCheck.run(makeContext(NOINDEX_HTML));

			expect(
				result.issues.some(
					(i) => i.severity === "critical" && i.message.toLowerCase().includes("noindex"),
				),
			).toBe(true);
			expect(result.score).toBeLessThanOrEqual(10);
			expect(result.status).toBe("fail");
		});

		it("noindex caps score even with perfect tags", async () => {
			const noindexExcellentHtml = EXCELLENT_HTML.replace(
				"</head>",
				'<meta name="robots" content="noindex, nofollow">\n</head>',
			);
			const result = await metaTagsCheck.run(makeContext(noindexExcellentHtml));

			expect(result.score).toBeLessThanOrEqual(10);
			expect(result.status).toBe("fail");
			expect(
				result.issues.some(
					(i) => i.severity === "critical" && i.message.toLowerCase().includes("noindex"),
				),
			).toBe(true);
		});
	});

	describe("details object", () => {
		it("contains expected fields for excellent page", async () => {
			const result = await metaTagsCheck.run(makeContext(EXCELLENT_HTML));

			const details = result.details as Record<string, unknown>;
			expect(details.title).toBeDefined();
			expect(details.titleLength).toBeGreaterThan(0);
			expect(details.hasDescription).toBe(true);
			expect(details.descriptionLength).toBeGreaterThan(0);
			expect(details.ogTagsPresent).toBeDefined();
			expect(Array.isArray(details.ogTagsPresent)).toBe(true);
			expect(details.hasCanonical).toBe(true);
			expect(details.htmlLang).toBe("de");
		});
	});
});
