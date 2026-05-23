import type {
	CheckContext,
	CheckPlugin,
	CheckSeverity,
	ScanCheck,
	ScanCheckIssue,
} from "@beacon/shared";
import { CHECK_METADATA_MAP } from "@beacon/shared";
import type { HTMLElement } from "node-html-parser";
import { defaultRegistry } from "../registry.js";

// ── Scoring weights ─────────────────────────────────────────

const POINTS = {
	title: 25,
	description: 25,
	canonical: 15,
	lang: 10,
	ogBasic: 15,
	noIssues: 10,
} as const;

const NOINDEX_SCORE_CAP = 10;

const STATUS_THRESHOLD_FAIL = 40;
const STATUS_THRESHOLD_PASS = 80;

const TITLE_MIN_LENGTH = 10;
const TITLE_MAX_LENGTH = 60;
const DESC_MIN_LENGTH = 50;
const DESC_MAX_LENGTH = 160;

// ── Interfaces ──────────────────────────────────────────────

interface ParsedMetaTags {
	title: { value: string | null; count: number };
	description: { value: string | null; count: number };
	charset: string | null;
	canonical: string | null;
	langAttribute: string | null;
	robots: string | null;
	og: {
		title: string | null;
		description: string | null;
		image: string | null;
		type: string | null;
		url: string | null;
	};
	twitter: {
		card: string | null;
		title: string | null;
		description: string | null;
	};
}

// ── Helpers ─────────────────────────────────────────────────

function addIssue(issues: ScanCheckIssue[], message: string, severity: CheckSeverity): void {
	issues.push({ message, severity });
}

/** Return trimmed value or null if empty/whitespace-only */
function nonEmpty(value: string | null | undefined): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

// ── Parser ──────────────────────────────────────────────────

function parseMetaTags(parsedHtml: unknown): ParsedMetaTags {
	const root = parsedHtml as HTMLElement;

	// Title
	const titleElements = root.querySelectorAll("title");
	const titleText = nonEmpty(titleElements[0]?.textContent);

	// Meta description
	const descElements = root.querySelectorAll('meta[name="description"]');
	const descValue = nonEmpty(descElements[0]?.getAttribute("content"));

	// Charset
	const charsetMeta = root.querySelector("meta[charset]");
	let charset = nonEmpty(charsetMeta?.getAttribute("charset"));
	if (!charset) {
		const httpEquiv = root.querySelector('meta[http-equiv="Content-Type"]');
		charset = nonEmpty(httpEquiv?.getAttribute("content"));
	}

	// Canonical
	const canonicalLink = root.querySelector('link[rel="canonical"]');
	const canonical = nonEmpty(canonicalLink?.getAttribute("href"));

	// Lang attribute
	const htmlElement = root.querySelector("html");
	const langAttribute = nonEmpty(htmlElement?.getAttribute("lang"));

	// Robots
	const robotsMeta = root.querySelector('meta[name="robots"]');
	const robots = nonEmpty(robotsMeta?.getAttribute("content"));

	// Open Graph — try property= first, then name= as fallback
	const getOg = (prop: string): string | null => {
		const byProperty = root.querySelector(`meta[property="og:${prop}"]`);
		if (byProperty) return nonEmpty(byProperty.getAttribute("content"));
		const byName = root.querySelector(`meta[name="og:${prop}"]`);
		return nonEmpty(byName?.getAttribute("content"));
	};

	// Twitter — try name= first, then property= as fallback
	const getTwitter = (prop: string): string | null => {
		const byName = root.querySelector(`meta[name="twitter:${prop}"]`);
		if (byName) return nonEmpty(byName.getAttribute("content"));
		const byProperty = root.querySelector(`meta[property="twitter:${prop}"]`);
		return nonEmpty(byProperty?.getAttribute("content"));
	};

	return {
		title: { value: titleText, count: titleElements.length },
		description: { value: descValue, count: descElements.length },
		charset,
		canonical,
		langAttribute,
		robots,
		og: {
			title: getOg("title"),
			description: getOg("description"),
			image: getOg("image"),
			type: getOg("type"),
			url: getOg("url"),
		},
		twitter: {
			card: getTwitter("card"),
			title: getTwitter("title"),
			description: getTwitter("description"),
		},
	};
}

// ── Score calculation ───────────────────────────────────────

function calculateScore(parsed: ParsedMetaTags): {
	score: number;
	issues: ScanCheckIssue[];
} {
	const issues: ScanCheckIssue[] = [];
	let score = 0;

	// 1. Title (25 points)
	if (parsed.title.value) {
		const len = parsed.title.value.length;
		if (len >= TITLE_MIN_LENGTH && len <= TITLE_MAX_LENGTH) {
			score += POINTS.title;
		} else {
			score += 17; // partial
			if (len < TITLE_MIN_LENGTH) {
				addIssue(
					issues,
					`Seitentitel ist zu kurz (${len} Zeichen) — empfohlen sind ${TITLE_MIN_LENGTH}-${TITLE_MAX_LENGTH} Zeichen`,
					"nice-to-have",
				);
			} else {
				addIssue(
					issues,
					`Seitentitel ist zu lang (${len} Zeichen) — empfohlen sind maximal ${TITLE_MAX_LENGTH} Zeichen`,
					"nice-to-have",
				);
			}
		}
	} else {
		addIssue(
			issues,
			"Kein Seitentitel gefunden — KI-Systeme können die Seite nicht identifizieren",
			"critical",
		);
	}

	// 2. Description (25 points)
	if (parsed.description.value) {
		const len = parsed.description.value.length;
		if (len >= DESC_MIN_LENGTH && len <= DESC_MAX_LENGTH) {
			score += POINTS.description;
		} else {
			score += 17; // partial
			if (len < DESC_MIN_LENGTH) {
				addIssue(
					issues,
					`Seitenbeschreibung ist zu kurz (${len} Zeichen) — empfohlen sind ${DESC_MIN_LENGTH}-${DESC_MAX_LENGTH} Zeichen`,
					"nice-to-have",
				);
			} else {
				addIssue(
					issues,
					`Seitenbeschreibung ist zu lang (${len} Zeichen) — empfohlen sind maximal ${DESC_MAX_LENGTH} Zeichen`,
					"nice-to-have",
				);
			}
		}
	} else {
		addIssue(
			issues,
			"Keine Seitenbeschreibung gefunden — KI-Systeme erhalten keine Zusammenfassung der Seite",
			"critical",
		);
	}

	// 3. Canonical (15 points)
	if (parsed.canonical) {
		score += POINTS.canonical;
	} else {
		addIssue(
			issues,
			"Kein Verweis auf die Originalseite (Canonical) gefunden — Suchmaschinen und KI-Systeme können doppelte Inhalte nicht erkennen",
			"important",
		);
	}

	// 4. Lang Attribute (10 points)
	if (parsed.langAttribute) {
		score += POINTS.lang;
	} else {
		addIssue(
			issues,
			"Keine Sprachangabe im HTML-Tag — KI-Systeme können die Sprache der Seite nicht erkennen",
			"nice-to-have",
		);
	}

	// 5. OG Basic (15 points) — only og:title + og:description
	const ogBasicCount = [parsed.og.title, parsed.og.description].filter((v) => v !== null).length;
	if (ogBasicCount === 2) {
		score += POINTS.ogBasic;
	} else if (ogBasicCount === 1) {
		score += 8;
	} else {
		addIssue(
			issues,
			"Keine Social-Media-Vorschau-Tags gefunden — Social-Media-Vorschauen und KI-Systeme können die Seite nicht korrekt darstellen",
			"important",
		);
	}

	// 6. Quality / No Issues (10 points)
	let qualityDeductions = 0;

	// Duplicate title
	if (parsed.title.count > 1) {
		addIssue(
			issues,
			`${parsed.title.count} Seitentitel gefunden — es darf nur genau einer vorhanden sein`,
			"important",
		);
		qualityDeductions += 5;
	}

	// Duplicate description
	if (parsed.description.count > 1) {
		addIssue(
			issues,
			`${parsed.description.count} Seitenbeschreibungen gefunden — es darf nur genau eine vorhanden sein`,
			"important",
		);
		qualityDeductions += 5;
	}

	// Only award noIssues bonus if at least some tags exist and no duplicates
	const hasAnyTags = parsed.title.value !== null || parsed.description.value !== null;
	if (hasAnyTags && qualityDeductions === 0) {
		score += POINTS.noIssues;
	} else if (hasAnyTags) {
		score += Math.max(0, POINTS.noIssues - qualityDeductions);
	}

	// noindex HARD CAP — applied AFTER normal scoring
	if (parsed.robots?.toLowerCase().includes("noindex")) {
		addIssue(
			issues,
			"Die Seite ist als nicht indexierbar markiert (noindex) — KI-Systeme werden diese Seite nicht in ihre Wissensbasis aufnehmen. Alle anderen Meta-Tags sind wirkungslos solange noindex aktiv ist.",
			"critical",
		);
		score = Math.min(score, NOINDEX_SCORE_CAP);
	}

	return { score: Math.min(100, score), issues };
}

// ── Check implementation ────────────────────────────────────

const META = CHECK_METADATA_MAP["meta-tags"];

const metaTagsCheck: CheckPlugin = {
	...META,

	async run(ctx: CheckContext): Promise<ScanCheck> {
		const parsed = parseMetaTags(ctx.parsedHtml);
		const result = calculateScore(parsed);

		// Status mapping
		let status: "pass" | "warn" | "fail";
		if (result.score < STATUS_THRESHOLD_FAIL) {
			status = "fail";
		} else if (result.score < STATUS_THRESHOLD_PASS) {
			status = "warn";
		} else {
			status = "pass";
		}

		const summaryMap = {
			pass: "Meta-Tags sind vollständig und für KI-Systeme gut optimiert",
			warn: "Meta-Tags vorhanden, aber unvollständig — wichtige Signale für KI-Systeme fehlen",
			fail: "Wichtige Meta-Tags fehlen — KI-Systeme können die Seite nicht korrekt erfassen",
		};

		return {
			...META,
			status,
			score: result.score,
			summary: summaryMap[status],
			issues: result.issues,
			details: {
				title: parsed.title.value,
				titleLength: parsed.title.value?.length ?? 0,
				hasDescription: parsed.description.value !== null,
				descriptionLength: parsed.description.value?.length ?? 0,
				ogTagsPresent: Object.entries(parsed.og)
					.filter(([, v]) => v !== null)
					.map(([k]) => `og:${k}`),
				twitterTagsPresent: Object.entries(parsed.twitter)
					.filter(([, v]) => v !== null)
					.map(([k]) => `twitter:${k}`),
				hasCanonical: parsed.canonical !== null,
				hasCharset: parsed.charset !== null,
				htmlLang: parsed.langAttribute,
				robotsDirective: parsed.robots,
			},
		};
	},
};

defaultRegistry.register(metaTagsCheck);

export default metaTagsCheck;
export { parseMetaTags, calculateScore, type ParsedMetaTags };
