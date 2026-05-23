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
	datePresence: 25,
	dateRecency: 30,
	modificationRecency: 20,
	signalRedundancy: 15,
	dateVisibility: 10,
} as const;

const STATUS_THRESHOLD_FAIL = 40;
const STATUS_THRESHOLD_PASS = 80;

const META = CHECK_METADATA_MAP["content-freshness"];

// ── Interfaces ──────────────────────────────────────────────

interface ParsedContentFreshness {
	jsonLdDatePublished: string | null;
	jsonLdDateModified: string | null;
	metaPublishedTime: string | null;
	metaModifiedTime: string | null;
	visibleTimeElements: string[];
	mostRecentDate: Date | null;
	dateAgeInDays: number | null;
	modificationAgeInDays: number | null;
	hasFutureDate: boolean;
	schemaOrgSignals: number;
	metaTagSignals: number;
	visibleSignals: number;
	totalChannels: number;
}

// ── Helpers ─────────────────────────────────────────────────

function isElement(node: unknown): node is HTMLElement {
	return node != null && typeof node === "object" && "querySelectorAll" in node;
}

function addIssue(issues: ScanCheckIssue[], message: string, severity: CheckSeverity): void {
	issues.push({ message, severity });
}

function tryParseDate(raw: string): Date | null {
	const d = new Date(raw);
	if (Number.isNaN(d.getTime())) return null;
	if (d.getFullYear() < 1990 || d.getFullYear() > 2100) return null;
	return d;
}

function daysBetween(a: Date, b: Date): number {
	return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
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

// ── Parser ──────────────────────────────────────────────────

function parseContentFreshness(parsedHtml: unknown, now?: Date): ParsedContentFreshness {
	const root = parsedHtml as HTMLElement;
	const referenceDate = now ?? new Date();

	// JSON-LD dates
	let jsonLdDatePublished: string | null = null;
	let jsonLdDateModified: string | null = null;

	if (isElement(root)) {
		const jsonLdBlocks = parseJsonLdBlocks(root);
		for (const block of jsonLdBlocks) {
			if (typeof block.datePublished === "string" && !jsonLdDatePublished) {
				jsonLdDatePublished = block.datePublished;
			}
			if (typeof block.dateModified === "string" && !jsonLdDateModified) {
				jsonLdDateModified = block.dateModified;
			}
		}
	}

	// Meta tags
	let metaPublishedTime: string | null = null;
	let metaModifiedTime: string | null = null;

	if (isElement(root)) {
		const pubMeta = root.querySelector('meta[property="article:published_time"]');
		metaPublishedTime = pubMeta?.getAttribute("content")?.trim() || null;

		const modMeta = root.querySelector('meta[property="article:modified_time"]');
		metaModifiedTime = modMeta?.getAttribute("content")?.trim() || null;
	}

	// Visible <time> elements
	const visibleTimeElements: string[] = [];
	if (isElement(root)) {
		const timeEls = root.querySelectorAll("time[datetime]");
		for (const el of timeEls) {
			const dt = el.getAttribute("datetime");
			if (dt) visibleTimeElements.push(dt);
		}
	}

	// Count signal channels
	let schemaOrgSignals = 0;
	if (jsonLdDatePublished) schemaOrgSignals++;
	if (jsonLdDateModified) schemaOrgSignals++;

	let metaTagSignals = 0;
	if (metaPublishedTime) metaTagSignals++;
	if (metaModifiedTime) metaTagSignals++;

	const visibleSignals = visibleTimeElements.length > 0 ? 1 : 0;

	let totalChannels = 0;
	if (schemaOrgSignals > 0) totalChannels++;
	if (metaTagSignals > 0) totalChannels++;
	if (visibleSignals > 0) totalChannels++;

	// Find most recent date and compute ages
	const allDateStrings: string[] = [];
	if (jsonLdDatePublished) allDateStrings.push(jsonLdDatePublished);
	if (jsonLdDateModified) allDateStrings.push(jsonLdDateModified);
	if (metaPublishedTime) allDateStrings.push(metaPublishedTime);
	if (metaModifiedTime) allDateStrings.push(metaModifiedTime);
	for (const dt of visibleTimeElements) allDateStrings.push(dt);

	let mostRecentDate: Date | null = null;
	let hasFutureDate = false;

	for (const raw of allDateStrings) {
		const d = tryParseDate(raw);
		if (!d) continue;
		if (d.getTime() > referenceDate.getTime()) {
			hasFutureDate = true;
		}
		if (!mostRecentDate || d.getTime() > mostRecentDate.getTime()) {
			mostRecentDate = d;
		}
	}

	const dateAgeInDays = mostRecentDate ? daysBetween(referenceDate, mostRecentDate) : null;

	// Modification age
	let modificationDate: Date | null = null;
	const modStrings = [jsonLdDateModified, metaModifiedTime].filter(Boolean) as string[];
	for (const raw of modStrings) {
		const d = tryParseDate(raw);
		if (!d) continue;
		if (!modificationDate || d.getTime() > modificationDate.getTime()) {
			modificationDate = d;
		}
	}
	const modificationAgeInDays = modificationDate
		? daysBetween(referenceDate, modificationDate)
		: null;

	return {
		jsonLdDatePublished,
		jsonLdDateModified,
		metaPublishedTime,
		metaModifiedTime,
		visibleTimeElements,
		mostRecentDate,
		dateAgeInDays,
		modificationAgeInDays,
		hasFutureDate,
		schemaOrgSignals,
		metaTagSignals,
		visibleSignals,
		totalChannels,
	};
}

// ── Score calculation ───────────────────────────────────────

function calculateScore(
	parsed: ParsedContentFreshness,
	now?: Date,
): {
	score: number;
	issues: ScanCheckIssue[];
} {
	const issues: ScanCheckIssue[] = [];
	let score = 0;

	const hasAnyDate =
		parsed.jsonLdDatePublished !== null ||
		parsed.metaPublishedTime !== null ||
		parsed.visibleTimeElements.length > 0 ||
		parsed.jsonLdDateModified !== null ||
		parsed.metaModifiedTime !== null;

	// 1. datePresence (25 pts)
	if (!hasAnyDate) {
		addIssue(
			issues,
			"Keine Datums-Angaben gefunden \u2014 KI-Systeme k\u00f6nnen die Aktualit\u00e4t dieser Seite nicht bewerten",
			"critical",
		);
	} else {
		if (parsed.jsonLdDatePublished) score += 10;
		if (parsed.metaPublishedTime) score += 8;
		if (parsed.visibleTimeElements.length > 0) score += 7;

		if (!parsed.jsonLdDatePublished && !parsed.metaPublishedTime) {
			addIssue(
				issues,
				"Kein Ver\u00f6ffentlichungsdatum gefunden \u2014 ohne Publikationsdatum stufen KI-Systeme Inhalte als weniger vertrauensw\u00fcrdig ein",
				"important",
			);
		}

		if (!parsed.jsonLdDateModified && !parsed.metaModifiedTime) {
			addIssue(
				issues,
				"Kein Aktualisierungsdatum gefunden \u2014 ein letztes \u00c4nderungsdatum signalisiert regelm\u00e4\u00dfige Pflege",
				"nice-to-have",
			);
		}
	}

	// 2. dateRecency (30 pts)
	if (parsed.dateAgeInDays !== null) {
		if (parsed.dateAgeInDays <= 90) {
			score += 30;
		} else if (parsed.dateAgeInDays <= 365) {
			score += 22;
		} else if (parsed.dateAgeInDays <= 730) {
			score += 14;
		} else if (parsed.dateAgeInDays <= 1095) {
			score += 6;
		}
		// >1095 → 0

		if (parsed.dateAgeInDays > 1095) {
			addIssue(
				issues,
				"Letztes Datum ist \u00e4lter als 3 Jahre \u2014 stark veraltete Inhalte werden von KI-Systemen seltener zitiert",
				"important",
			);
		} else if (parsed.dateAgeInDays > 365) {
			addIssue(
				issues,
				"Letztes Datum ist \u00e4lter als 1 Jahr \u2014 regelm\u00e4\u00dfige Aktualisierungen verbessern die Sichtbarkeit bei KI-Systemen",
				"important",
			);
		}
	}

	// 3. modificationRecency (20 pts)
	if (parsed.modificationAgeInDays !== null) {
		if (parsed.modificationAgeInDays <= 90) {
			score += 20;
		} else if (parsed.modificationAgeInDays <= 365) {
			score += 14;
		} else if (parsed.modificationAgeInDays <= 730) {
			score += 8;
		} else {
			score += 3;
		}
	}

	// 4. signalRedundancy (15 pts)
	if (parsed.totalChannels >= 3) {
		score += 15;
	} else if (parsed.totalChannels === 2) {
		score += 10;
	} else if (parsed.totalChannels === 1) {
		score += 5;
		addIssue(
			issues,
			"Datumsangaben nur in einem Format vorhanden \u2014 mehrere Quellen (Strukturierte Daten, Meta-Tags, sichtbar im Text) erh\u00f6hen die Zuverl\u00e4ssigkeit",
			"important",
		);
	}
	// 0 channels → 0 pts (already flagged by datePresence)

	// 5. dateVisibility (10 pts)
	if (parsed.visibleTimeElements.length > 0) {
		score += 10;
	} else if (hasAnyDate) {
		score += 3;
		addIssue(
			issues,
			"Keine sichtbaren Datumsangaben im Seiteninhalt \u2014 f\u00fcr Nutzer sichtbare Daten st\u00e4rken das Vertrauen",
			"nice-to-have",
		);
	}

	// Future date penalty
	if (parsed.hasFutureDate) {
		addIssue(
			issues,
			"Datum in der Zukunft erkannt \u2014 fehlerhafte Datumsangaben k\u00f6nnen die Glaubw\u00fcrdigkeit beeintr\u00e4chtigen",
			"critical",
		);
	}

	return { score: Math.min(100, score), issues };
}

// ── Check implementation ────────────────────────────────────

const SUMMARY_MAP = {
	pass: "Gute Aktualit\u00e4tssignale \u2014 die Seite liefert aktuelle Datumsangaben in mehreren Formaten f\u00fcr KI-Systeme.",
	warn: "Eingeschr\u00e4nkte Aktualit\u00e4tssignale \u2014 einige Datumsangaben fehlen oder die Inhalte sind nicht mehr aktuell.",
	fail: "Fehlende Aktualit\u00e4tssignale \u2014 KI-Systeme k\u00f6nnen die Aktualit\u00e4t der Seite nicht bewerten.",
};

const contentFreshnessCheck: CheckPlugin = {
	...META,

	async run(ctx: CheckContext): Promise<ScanCheck> {
		const parsed = parseContentFreshness(ctx.parsedHtml);
		const result = calculateScore(parsed);

		let status: "pass" | "warn" | "fail";
		if (result.score < STATUS_THRESHOLD_FAIL) {
			status = "fail";
		} else if (result.score < STATUS_THRESHOLD_PASS) {
			status = "warn";
		} else {
			status = "pass";
		}

		return {
			...META,
			status,
			score: result.score,
			summary: SUMMARY_MAP[status],
			issues: result.issues,
			details: {
				jsonLdDatePublished: parsed.jsonLdDatePublished,
				jsonLdDateModified: parsed.jsonLdDateModified,
				metaPublishedTime: parsed.metaPublishedTime,
				metaModifiedTime: parsed.metaModifiedTime,
				visibleTimeElements: parsed.visibleTimeElements,
				mostRecentDate: parsed.mostRecentDate?.toISOString() ?? null,
				dateAgeInDays: parsed.dateAgeInDays !== null ? Math.round(parsed.dateAgeInDays) : null,
				modificationAgeInDays:
					parsed.modificationAgeInDays !== null ? Math.round(parsed.modificationAgeInDays) : null,
				hasFutureDate: parsed.hasFutureDate,
				schemaOrgSignals: parsed.schemaOrgSignals,
				metaTagSignals: parsed.metaTagSignals,
				visibleSignals: parsed.visibleSignals,
				totalChannels: parsed.totalChannels,
			},
		};
	},
};

defaultRegistry.register(contentFreshnessCheck);

export default contentFreshnessCheck;
export { parseContentFreshness, calculateScore, type ParsedContentFreshness };
