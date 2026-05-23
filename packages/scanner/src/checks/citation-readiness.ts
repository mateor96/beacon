// Boundary note: this check performs rule-based citation-readiness heuristics.
// Deep citation analysis (quotability, authority, etc.) is handled by the
// on-demand AI analysis in @beacon/ai pipeline.ts (analyzeCitationReadiness).

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

// ── Scoring weights (100 total) ─────────────────────────────

const POINTS = {
	authorship: 15,
	publicationDate: 15,
	updateDate: 10,
	articleSchemaDepth: 15,
	canonicalTag: 5,
	factualCredibility: 20,
	semanticCitationHtml: 10,
	ogArticleMetadata: 10,
} as const;

const STATUS_THRESHOLD_FAIL = 40;
const STATUS_THRESHOLD_PASS = 80;

const ARTICLE_SCHEMA_FIELDS = [
	"headline",
	"author",
	"datePublished",
	"dateModified",
	"description",
	"image",
	"publisher",
	"mainEntityOfPage",
] as const;

const ARTICLE_OG_PROPERTIES = [
	"article:published_time",
	"article:modified_time",
	"article:author",
	"article:section",
	"article:tag",
] as const;

// ── Interfaces ──────────────────────────────────────────────

interface ParsedCitationReadiness {
	hasMetaAuthor: boolean;
	hasJsonLdAuthor: boolean;
	hasRelAuthor: boolean;
	hasBylinePattern: boolean;
	hasMetaPublishedTime: boolean;
	hasJsonLdDatePublished: boolean;
	hasTimeElement: boolean;
	hasJsonLdDateModified: boolean;
	hasMetaModifiedTime: boolean;
	articleSchemaType: string | null;
	articleSchemaPropertyCount: number;
	hasCanonical: boolean;
	canonicalMatchesUrl: boolean;
	externalLinkCount: number;
	numberCount: number;
	hasBlockquote: boolean;
	hasCiteElement: boolean;
	hasTimeTag: boolean;
	hasCiteTag: boolean;
	hasFigureWithCaption: boolean;
	hasDfnTag: boolean;
	ogTypeIsArticle: boolean;
	articlePropertyCount: number;
}

// ── Helpers ─────────────────────────────────────────────────

function addIssue(issues: ScanCheckIssue[], message: string, severity: CheckSeverity): void {
	issues.push({ message, severity });
}

function nonEmpty(value: string | null | undefined): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function parseJsonLdBlocks(root: HTMLElement): Record<string, unknown>[] {
	const results: Record<string, unknown>[] = [];
	const scripts = root.querySelectorAll('script[type="application/ld+json"]');

	for (const script of scripts) {
		const text = script.textContent?.trim();
		if (!text) continue;

		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			continue;
		}

		if (Array.isArray(parsed)) {
			for (const item of parsed) {
				if (item && typeof item === "object" && !Array.isArray(item)) {
					results.push(item as Record<string, unknown>);
				}
			}
		} else if (parsed && typeof parsed === "object") {
			const obj = parsed as Record<string, unknown>;
			if (Array.isArray(obj["@graph"])) {
				for (const item of obj["@graph"] as unknown[]) {
					if (item && typeof item === "object" && !Array.isArray(item)) {
						results.push(item as Record<string, unknown>);
					}
				}
			} else {
				results.push(obj);
			}
		}
	}

	return results;
}

function normalizeHostname(hostname: string): string {
	return hostname.replace(/^www\./, "").toLowerCase();
}

function isExternalLink(href: string, contextUrl: string): boolean {
	try {
		const linkUrl = new URL(href, contextUrl);
		const ctxUrl = new URL(contextUrl);
		if (!linkUrl.protocol.startsWith("http")) return false;
		return normalizeHostname(linkUrl.hostname) !== normalizeHostname(ctxUrl.hostname);
	} catch {
		return false;
	}
}

// ── Parser ──────────────────────────────────────────────────

function parseCitationReadiness(parsedHtml: unknown, url: string): ParsedCitationReadiness {
	const root = parsedHtml as HTMLElement;
	const jsonLdBlocks = parseJsonLdBlocks(root);

	// Authorship
	const hasMetaAuthor = root.querySelector('meta[name="author"]')?.getAttribute("content")
		? nonEmpty(root.querySelector('meta[name="author"]')?.getAttribute("content")) !== null
		: false;

	let hasJsonLdAuthor = false;
	for (const block of jsonLdBlocks) {
		if (block.author != null) {
			hasJsonLdAuthor = true;
			break;
		}
	}

	const hasRelAuthor = root.querySelector('a[rel="author"]') !== null;

	const hasBylinePattern =
		root.querySelector('[class*="author"]') !== null ||
		root.querySelector('[class*="byline"]') !== null ||
		root.querySelector('[itemprop="author"]') !== null;

	// Publication Date
	const hasMetaPublishedTime =
		nonEmpty(
			root.querySelector('meta[property="article:published_time"]')?.getAttribute("content"),
		) !== null;

	let hasJsonLdDatePublished = false;
	for (const block of jsonLdBlocks) {
		if (block.datePublished != null) {
			hasJsonLdDatePublished = true;
			break;
		}
	}

	const timeElements = root.querySelectorAll("time[datetime]");
	const hasTimeElement = timeElements.length > 0;

	// Update Date
	let hasJsonLdDateModified = false;
	for (const block of jsonLdBlocks) {
		if (block.dateModified != null) {
			hasJsonLdDateModified = true;
			break;
		}
	}

	const hasMetaModifiedTime =
		nonEmpty(
			root.querySelector('meta[property="article:modified_time"]')?.getAttribute("content"),
		) !== null;

	// Article Schema Depth
	const articleTypes = new Set(["Article", "NewsArticle", "BlogPosting"]);
	let articleSchemaType: string | null = null;
	let articleSchemaPropertyCount = 0;

	for (const block of jsonLdBlocks) {
		const blockType = typeof block["@type"] === "string" ? block["@type"] : null;
		if (blockType && articleTypes.has(blockType)) {
			articleSchemaType = blockType;
			let count = 0;
			for (const field of ARTICLE_SCHEMA_FIELDS) {
				if (block[field] != null) count++;
			}
			articleSchemaPropertyCount = Math.max(articleSchemaPropertyCount, count);
		}
	}

	// Canonical Tag
	const canonicalLink = root.querySelector('link[rel="canonical"]');
	const canonicalHref = nonEmpty(canonicalLink?.getAttribute("href"));
	const hasCanonical = canonicalHref !== null;

	let canonicalMatchesUrl = false;
	if (canonicalHref) {
		try {
			const canonUrl = new URL(canonicalHref, url).href.replace(/\/$/, "");
			const ctxUrl = new URL(url).href.replace(/\/$/, "");
			canonicalMatchesUrl = canonUrl === ctxUrl;
		} catch {
			canonicalMatchesUrl = false;
		}
	}

	// Factual Credibility — count external links in main/article content
	const mainEl =
		root.querySelector("main") ?? root.querySelector("article") ?? root.querySelector("body");
	let externalLinkCount = 0;
	if (mainEl) {
		const links = mainEl.querySelectorAll("a[href]");
		for (const link of links) {
			const href = link.getAttribute("href");
			if (href && isExternalLink(href, url)) {
				externalLinkCount++;
			}
		}
	}

	// Numbers in main content
	const mainText = mainEl?.textContent ?? "";
	const numberCount = (mainText.match(/\b\d[\d.,]*\b/g) || []).length;

	const hasBlockquote = root.querySelector("blockquote") !== null;
	const hasCiteElement = root.querySelector("cite") !== null;

	// Semantic Citation HTML
	const hasTimeTag = root.querySelector("time") !== null;
	const hasCiteTag = hasCiteElement;
	const figures = root.querySelectorAll("figure");
	let hasFigureWithCaption = false;
	for (const fig of figures) {
		if (fig.querySelector("figcaption")) {
			hasFigureWithCaption = true;
			break;
		}
	}
	const hasDfnTag = root.querySelector("dfn") !== null;

	// OG Article Metadata
	const ogType = nonEmpty(root.querySelector('meta[property="og:type"]')?.getAttribute("content"));
	const ogTypeIsArticle = ogType?.toLowerCase() === "article";

	let articlePropertyCount = 0;
	for (const prop of ARTICLE_OG_PROPERTIES) {
		if (
			nonEmpty(root.querySelector(`meta[property="${prop}"]`)?.getAttribute("content")) !== null
		) {
			articlePropertyCount++;
		}
	}

	return {
		hasMetaAuthor,
		hasJsonLdAuthor,
		hasRelAuthor,
		hasBylinePattern,
		hasMetaPublishedTime,
		hasJsonLdDatePublished,
		hasTimeElement,
		hasJsonLdDateModified,
		hasMetaModifiedTime,
		articleSchemaType,
		articleSchemaPropertyCount,
		hasCanonical,
		canonicalMatchesUrl,
		externalLinkCount,
		numberCount,
		hasBlockquote,
		hasCiteElement,
		hasTimeTag,
		hasCiteTag,
		hasFigureWithCaption,
		hasDfnTag,
		ogTypeIsArticle,
		articlePropertyCount,
	};
}

// ── Score calculation ───────────────────────────────────────

function calculateScore(parsed: ParsedCitationReadiness): {
	score: number;
	issues: ScanCheckIssue[];
} {
	const issues: ScanCheckIssue[] = [];
	let score = 0;

	// 1. Authorship (15 pts)
	const hasAnyAuthor =
		parsed.hasJsonLdAuthor ||
		parsed.hasMetaAuthor ||
		parsed.hasRelAuthor ||
		parsed.hasBylinePattern;
	if (!hasAnyAuthor) {
		addIssue(
			issues,
			"Keine Autorenangabe gefunden — KI-Suchmaschinen bevorzugen Inhalte mit klarer Autorenschaft",
			"critical",
		);
	} else {
		if (parsed.hasJsonLdAuthor || parsed.hasMetaAuthor) {
			score += 8;
		}
		if (parsed.hasRelAuthor || parsed.hasBylinePattern) {
			score += 4;
		}
		if (parsed.hasJsonLdAuthor && parsed.hasMetaAuthor) {
			score += 3;
		}
	}

	// 2. Publication Date (15 pts)
	const hasAnyPubDate =
		parsed.hasJsonLdDatePublished || parsed.hasMetaPublishedTime || parsed.hasTimeElement;
	if (!hasAnyPubDate) {
		addIssue(
			issues,
			"Kein Publikationsdatum gefunden — Aktualität ist ein wichtiges Signal für Glaubwürdigkeit",
			"important",
		);
	} else {
		if (parsed.hasJsonLdDatePublished || parsed.hasMetaPublishedTime) {
			score += 10;
		}
		if (parsed.hasTimeElement) {
			score += 5;
		}
	}

	// 3. Update Date (10 pts)
	if (parsed.hasJsonLdDateModified) {
		score += 6;
	}
	if (parsed.hasMetaModifiedTime) {
		score += 4;
	}
	if (!parsed.hasJsonLdDateModified && !parsed.hasMetaModifiedTime) {
		addIssue(
			issues,
			"Kein Aktualisierungsdatum gefunden — regelmäßige Updates signalisieren Zuverlässigkeit",
			"nice-to-have",
		);
	}

	// 4. Article Schema Depth (15 pts)
	if (parsed.articleSchemaType) {
		score += 5;
		const completeness = parsed.articleSchemaPropertyCount / ARTICLE_SCHEMA_FIELDS.length;
		if (completeness >= 0.75) {
			score += 10;
		} else if (completeness >= 0.5) {
			score += 7;
		} else if (completeness >= 0.25) {
			score += 4;
		} else {
			score += 1;
		}
	} else {
		addIssue(
			issues,
			"Kein Article/NewsArticle/BlogPosting Schema gefunden — strukturierte Daten erhöhen die Zitierbarkeit",
			"important",
		);
	}

	// 5. Canonical Tag (5 pts)
	if (parsed.hasCanonical) {
		score += 3;
		if (parsed.canonicalMatchesUrl) {
			score += 2;
		}
	}

	// 6. Factual Credibility (20 pts)
	const hasAnyCredibility =
		parsed.externalLinkCount > 0 ||
		parsed.numberCount > 0 ||
		parsed.hasBlockquote ||
		parsed.hasCiteElement;

	if (!hasAnyCredibility) {
		addIssue(
			issues,
			"Keine Glaubwürdigkeitssignale gefunden — externe Quellen, Zahlen und Zitate stärken die Zitierbarkeit",
			"important",
		);
	}

	if (parsed.externalLinkCount >= 3) {
		score += 8;
	} else if (parsed.externalLinkCount >= 1) {
		score += 5;
	}

	if (parsed.numberCount >= 5) {
		score += 5;
	} else if (parsed.numberCount >= 2) {
		score += 3;
	}

	if (parsed.hasBlockquote) {
		score += 4;
	}

	if (parsed.hasCiteElement) {
		score += 3;
	}

	// 7. Semantic Citation HTML (10 pts)
	let semanticCount = 0;
	if (parsed.hasTimeTag) semanticCount++;
	if (parsed.hasBlockquote) semanticCount++;
	if (parsed.hasCiteTag) semanticCount++;
	if (parsed.hasFigureWithCaption) semanticCount++;
	if (parsed.hasDfnTag) semanticCount++;

	score += Math.min(POINTS.semanticCitationHtml, semanticCount * 2);

	if (semanticCount === 0) {
		addIssue(
			issues,
			"Keine Zitier-Auszeichnungen (Zeitstempel, Zitate, Quellenangaben) gefunden",
			"nice-to-have",
		);
	}

	// 8. OG Article Metadata (10 pts)
	if (parsed.ogTypeIsArticle) {
		score += 4;
		score += Math.min(6, parsed.articlePropertyCount * 2);
	} else {
		addIssue(
			issues,
			"Social-Media-Seitentyp ist nicht als Artikel markiert — Social-Media-Metadaten verbessern die KI-Zitierbarkeit",
			"nice-to-have",
		);
	}

	return { score: Math.min(100, score), issues };
}

// ── Check implementation ────────────────────────────────────

const SUMMARY_MAP = {
	pass: "Hohe Zitierbarkeit — die Seite liefert ausreichend Signale für KI-Suchmaschinen, um als Quelle zitiert zu werden.",
	warn: "Mittlere Zitierbarkeit — einige wichtige Signale wie Autorenschaft oder Publikationsdatum fehlen.",
	fail: "Niedrige Zitierbarkeit — wesentliche Signale für KI-Zitierung fehlen oder sind unvollständig.",
};

const META = CHECK_METADATA_MAP["citation-readiness"];

const citationReadinessCheck: CheckPlugin = {
	...META,

	async run(ctx: CheckContext): Promise<ScanCheck> {
		const parsed = parseCitationReadiness(ctx.parsedHtml, ctx.finalUrl);
		const result = calculateScore(parsed);

		let status: "pass" | "warn" | "fail";
		if (result.score < STATUS_THRESHOLD_FAIL) {
			status = "fail";
		} else if (result.score < STATUS_THRESHOLD_PASS) {
			status = "warn";
		} else {
			status = "pass";
		}

		const semanticElementCount = [
			parsed.hasTimeTag,
			parsed.hasBlockquote,
			parsed.hasCiteTag,
			parsed.hasFigureWithCaption,
			parsed.hasDfnTag,
		].filter(Boolean).length;

		return {
			...META,
			status,
			score: result.score,
			summary: SUMMARY_MAP[status],
			issues: result.issues,
			details: {
				hasAuthor:
					parsed.hasJsonLdAuthor ||
					parsed.hasMetaAuthor ||
					parsed.hasRelAuthor ||
					parsed.hasBylinePattern,
				hasPublicationDate:
					parsed.hasJsonLdDatePublished || parsed.hasMetaPublishedTime || parsed.hasTimeElement,
				hasUpdateDate: parsed.hasJsonLdDateModified || parsed.hasMetaModifiedTime,
				articleSchemaType: parsed.articleSchemaType,
				articleSchemaPropertyCount: parsed.articleSchemaPropertyCount,
				hasCanonical: parsed.hasCanonical,
				canonicalMatchesUrl: parsed.canonicalMatchesUrl,
				externalLinkCount: parsed.externalLinkCount,
				numberCount: parsed.numberCount,
				hasBlockquote: parsed.hasBlockquote,
				hasCiteElement: parsed.hasCiteElement,
				semanticElementCount,
				ogTypeIsArticle: parsed.ogTypeIsArticle,
				articleOgPropertyCount: parsed.articlePropertyCount,
			},
		};
	},
};

defaultRegistry.register(citationReadinessCheck);

export default citationReadinessCheck;
export { parseCitationReadiness, calculateScore, type ParsedCitationReadiness };
