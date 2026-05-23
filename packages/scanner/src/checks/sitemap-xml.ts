import type {
	CheckContext,
	CheckPlugin,
	CheckSeverity,
	ScanCheck,
	ScanCheckIssue,
} from "@beacon/shared";
import { CHECK_METADATA_MAP, isHtmlResponse } from "@beacon/shared";

import { defaultRegistry } from "../registry.js";

// ── Scoring weights ───��─────────────────────────────────────

const POINTS = {
	exists: 20,
	validXml: 15,
	urlCount: 20,
	hasLastmod: 20,
	hasChangefreq: 5,
	hasPriority: 5,
	robotsTxtRef: 10,
	properNamespace: 5,
} as const;

const STATUS_THRESHOLD_FAIL = 40;
const STATUS_THRESHOLD_PASS = 80;

const SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";

// ── Interfaces ────���─────────────────────────────────────────

interface ParsedSitemap {
	rootElement: "urlset" | "sitemapindex" | null;
	namespace: string | null;
	entryCount: number;
	lastmodCount: number;
	changefreqCount: number;
	priorityCount: number;
	xmlWellFormed: boolean;
	isSitemapIndex: boolean;
}

// ── Helpers ─────────────────────────���───────────────────────

function addIssue(issues: ScanCheckIssue[], message: string, severity: CheckSeverity): void {
	issues.push({ message, severity });
}

// ── Parser ──────────────────────────────────────────────────

function parseSitemap(content: string): ParsedSitemap {
	const trimmed = content.trim();

	const hasUrlset = /<urlset[\s>]/i.test(trimmed);
	const hasSitemapIndex = /<sitemapindex[\s>]/i.test(trimmed);
	const isSitemapIndex = hasSitemapIndex && !hasUrlset;

	let rootElement: "urlset" | "sitemapindex" | null = null;
	if (hasUrlset) rootElement = "urlset";
	else if (hasSitemapIndex) rootElement = "sitemapindex";

	// Extract namespace
	const nsMatch = trimmed.match(/xmlns\s*=\s*"([^"]+)"/i);
	const namespace = nsMatch ? nsMatch[1] : null;

	// Count entries
	const entryTag = isSitemapIndex ? "sitemap" : "url";
	const entryRegex = new RegExp(`<${entryTag}[\\s>]`, "gi");
	const entryCount = (trimmed.match(entryRegex) || []).length;

	// Count metadata tags
	const lastmodCount = (trimmed.match(/<lastmod[\s>]/gi) || []).length;
	const changefreqCount = (trimmed.match(/<changefreq[\s>]/gi) || []).length;
	const priorityCount = (trimmed.match(/<priority[\s>]/gi) || []).length;

	// Basic well-formedness
	const hasClosingRoot =
		(hasUrlset && /<\/urlset\s*>/i.test(trimmed)) ||
		(hasSitemapIndex && /<\/sitemapindex\s*>/i.test(trimmed));
	const xmlWellFormed = rootElement !== null && hasClosingRoot;

	return {
		rootElement,
		namespace,
		entryCount,
		lastmodCount,
		changefreqCount,
		priorityCount,
		xmlWellFormed,
		isSitemapIndex,
	};
}

// ── Score calculation ───────────────────────────────────────

function calculateScore(
	parsed: ParsedSitemap,
	robotsTxtSitemaps: string[],
): { score: number; issues: ScanCheckIssue[] } {
	const issues: ScanCheckIssue[] = [];
	let score = POINTS.exists;

	// validXml
	if (parsed.xmlWellFormed) {
		score += POINTS.validXml;
	} else if (parsed.rootElement === null) {
		addIssue(
			issues,
			"Sitemap enthält kein gültiges Wurzelelement — KI-Systeme können die Datei nicht verarbeiten",
			"critical",
		);
	} else {
		addIssue(
			issues,
			"Sitemap-XML ist fehlerhaft strukturiert — einige KI-Systeme könnten die Datei ablehnen",
			"important",
		);
	}

	// urlCount
	if (parsed.entryCount > 10) {
		score += POINTS.urlCount;
	} else if (parsed.entryCount > 0) {
		score += Math.floor(POINTS.urlCount / 2);
		const entryLabel = parsed.isSitemapIndex ? "Sitemaps" : "URLs";
		addIssue(
			issues,
			`Sitemap enthält nur ${parsed.entryCount} ${entryLabel} — eine umfassendere Sitemap verbessert die Auffindbarkeit durch KI-Systeme`,
			"nice-to-have",
		);
	} else {
		const entryLabel = parsed.isSitemapIndex ? "Sitemap-Verweise" : "URL-Eintraege";
		addIssue(
			issues,
			`Sitemap enthält keine ${entryLabel} — eine leere Sitemap ist für KI-Systeme nutzlos`,
			"critical",
		);
	}

	// hasLastmod
	if (parsed.entryCount > 0 && parsed.lastmodCount >= parsed.entryCount * 0.5) {
		score += POINTS.hasLastmod;
	} else if (parsed.lastmodCount > 0) {
		score += Math.floor(POINTS.hasLastmod / 2);
		addIssue(
			issues,
			`Nur ${parsed.lastmodCount} von ${parsed.entryCount} Einträgen haben ein Aktualisierungsdatum — KI-Systeme nutzen dieses Datum um aktualisierte Inhalte zu priorisieren`,
			"important",
		);
	} else if (parsed.entryCount > 0) {
		addIssue(
			issues,
			"Kein Aktualisierungsdatum in der Sitemap — KI-Systeme können nicht erkennen welche Seiten aktualisiert wurden",
			"important",
		);
	}

	// hasChangefreq
	if (parsed.entryCount > 0 && parsed.changefreqCount >= parsed.entryCount * 0.5) {
		score += POINTS.hasChangefreq;
	} else if (parsed.changefreqCount > 0) {
		score += Math.floor(POINTS.hasChangefreq / 2);
	} else if (parsed.entryCount > 0) {
		addIssue(
			issues,
			"Keine Änderungshäufigkeit in der Sitemap — KI-Systemen fehlt ein Hinweis zur Aktualisierungshäufigkeit",
			"nice-to-have",
		);
	}

	// hasPriority
	if (parsed.entryCount > 0 && parsed.priorityCount >= parsed.entryCount * 0.5) {
		score += POINTS.hasPriority;
	} else if (parsed.priorityCount > 0) {
		score += Math.floor(POINTS.hasPriority / 2);
	}

	// robotsTxtRef
	if (robotsTxtSitemaps.length > 0) {
		score += POINTS.robotsTxtRef;
	} else {
		addIssue(
			issues,
			"Kein Sitemap-Verweis in robots.txt — fügen Sie 'Sitemap: https://example.com/sitemap.xml' in Ihre robots.txt ein damit KI-Systeme die Sitemap automatisch finden",
			"nice-to-have",
		);
	}

	// properNamespace
	if (parsed.namespace === SITEMAP_NAMESPACE) {
		score += POINTS.properNamespace;
	} else if (parsed.namespace) {
		addIssue(
			issues,
			`Unerwartete Formatvorgabe: ${parsed.namespace} — die Standard-Formatvorgabe ist ${SITEMAP_NAMESPACE}`,
			"nice-to-have",
		);
	}

	// Informational: sitemap index detected
	if (parsed.isSitemapIndex) {
		addIssue(
			issues,
			`Sitemap-Index mit ${parsed.entryCount} referenzierten Sitemaps erkannt — die einzelnen Sitemaps werden nicht separat geprüft`,
			"nice-to-have",
		);
	}

	return { score: Math.min(100, score), issues };
}

// ── Check implementation ────────────────────────────────────

const META = CHECK_METADATA_MAP["sitemap-xml"];

const sitemapXmlCheck: CheckPlugin = {
	...META,

	async run(ctx: CheckContext): Promise<ScanCheck> {
		const sitemapContent = ctx.subResources["/sitemap.xml"];

		// Not found
		if (!sitemapContent) {
			return {
				...META,
				status: "fail",
				score: 0,
				summary: "Sitemap fehlt oder ist für KI-Systeme nicht nutzbar",
				issues: [
					{
						message:
							"Keine Sitemap unter /sitemap.xml gefunden — eine XML-Sitemap hilft KI-Systemen alle relevanten Seiten Ihrer Website zu entdecken",
						severity: "important",
					},
				],
			};
		}

		const content = sitemapContent.content;

		// Soft-404
		if (isHtmlResponse(content)) {
			return {
				...META,
				status: "fail",
				score: 0,
				summary: "Sitemap fehlt oder ist für KI-Systeme nicht nutzbar",
				issues: [
					{
						message:
							"Unter /sitemap.xml wird eine HTML-Seite ausgeliefert statt einer XML-Datei — prüfen Sie die Serverkonfiguration",
						severity: "critical",
					},
				],
			};
		}

		// Empty file
		if (content.trim().length === 0) {
			return {
				...META,
				status: "fail",
				score: POINTS.exists,
				summary: "Sitemap fehlt oder ist für KI-Systeme nicht nutzbar",
				issues: [
					{
						message: "Die Sitemap-Datei ist vorhanden aber leer — fügen Sie URL-Einträge hinzu",
						severity: "critical",
					},
				],
			};
		}

		// Extract Sitemap: directives from robots.txt
		const robotsTxtResource = ctx.subResources["/robots.txt"];
		let robotsTxtSitemaps: string[] = [];
		if (robotsTxtResource) {
			const matches = robotsTxtResource.content.matchAll(/^Sitemap:\s*(.+)/gim);
			robotsTxtSitemaps = [...matches].map((m) => m[1].trim());
		}

		// Parse and score
		const parsed = parseSitemap(content);
		const result = calculateScore(parsed, robotsTxtSitemaps);

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
			pass: "Sitemap ist vollständig und gut strukturiert für KI-Systeme",
			warn: "Sitemap vorhanden, aber unvollständig oder ohne Zusatzinformationen",
			fail: "Sitemap fehlt oder ist für KI-Systeme nicht nutzbar",
		};

		return {
			...META,
			status,
			score: result.score,
			summary: summaryMap[status],
			issues: result.issues,
			details: {
				rootElement: parsed.rootElement,
				isSitemapIndex: parsed.isSitemapIndex,
				namespace: parsed.namespace,
				entryCount: parsed.entryCount,
				lastmodCount: parsed.lastmodCount,
				changefreqCount: parsed.changefreqCount,
				priorityCount: parsed.priorityCount,
				xmlWellFormed: parsed.xmlWellFormed,
				robotsTxtSitemapCount: robotsTxtSitemaps.length,
			},
		};
	},
};

defaultRegistry.register(sitemapXmlCheck);

export default sitemapXmlCheck;
export { parseSitemap, calculateScore, type ParsedSitemap };
