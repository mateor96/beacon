import type {
	CheckContext,
	CheckPlugin,
	CheckSeverity,
	ScanCheck,
	ScanCheckIssue,
} from "@beacon/shared";
import { CHECK_METADATA_MAP, isHtmlResponse } from "@beacon/shared";

import { defaultRegistry } from "../registry.js";
import { type ParsedLlmsTxt, parseLlmsTxt } from "./llms-txt-parser.js";

// ── Scoring weights ──────────────────────────────────────────

const POINTS = {
	exists: 15,
	h1: 25,
	blockquote: 10,
	h2WithLinks: 20,
	linkFormat: 15,
	length: 10,
	noHtml: 5,
} as const;

const STATUS_THRESHOLD_FAIL = 40;
const STATUS_THRESHOLD_PASS = 80;
const MIN_CONTENT_LENGTH = 200;

function addIssue(
	issues: ScanCheckIssue[],
	message: string,
	severity: CheckSeverity,
	context?: string,
): void {
	issues.push({ message, severity, context });
}

// ── Score calculation ────────────────────────────────────────

function calculateScore(parsed: ParsedLlmsTxt): { score: number; issues: ScanCheckIssue[] } {
	const issues: ScanCheckIssue[] = [];
	let score = POINTS.exists; // file exists if we got here

	// H1 Header (genau 1)
	if (parsed.h1Lines.length === 1) {
		score += POINTS.h1;
	} else if (parsed.h1Lines.length === 0) {
		addIssue(
			issues,
			"Kein Haupttitel gefunden — KI-Systeme können den Namen Ihres Unternehmens nicht aus der llms.txt lesen",
			"critical",
		);
	} else {
		score += Math.floor(POINTS.h1 / 2); // partial credit
		addIssue(
			issues,
			`${parsed.h1Lines.length} Haupttitel gefunden — laut Spezifikation darf nur genau einer vorhanden sein`,
			"important",
		);
	}

	// Blockquote
	if (parsed.hasBlockquote) {
		score += POINTS.blockquote;
	} else {
		addIssue(
			issues,
			"Keine Zusammenfassung gefunden — KI-Systeme erhalten keinen schnellen Überblick über Ihr Unternehmen",
			"important",
		);
	}

	// H2-Sektionen mit Links
	if (parsed.h2Sections.length > 0 && parsed.markdownLinks.length > 0) {
		score += POINTS.h2WithLinks;
	} else if (parsed.h2Sections.length > 0) {
		score += Math.floor(POINTS.h2WithLinks / 2);
		addIssue(
			issues,
			"Unterabschnitte vorhanden, aber keine Links gefunden — verlinken Sie auf weiterführende Dokumentation",
			"important",
		);
	} else {
		addIssue(
			issues,
			"Keine Unterabschnitte mit Links gefunden — KI-Systeme haben keinen Kontext über Ihre Produkte und Services",
			"important",
		);
	}

	// Link-Format
	if (parsed.markdownLinks.length > 0) {
		const linksWithDescription = [...parsed.content.matchAll(/- \[.+?\]\(.+?\): .+/g)];
		if (linksWithDescription.length >= parsed.markdownLinks.length / 2) {
			score += POINTS.linkFormat;
		} else {
			score += Math.floor(POINTS.linkFormat / 2);
			addIssue(
				issues,
				"Weniger als die Hälfte der Links haben eine Beschreibung — Beschreibungen helfen KI-Systemen den Kontext der verlinkten Ressourcen zu verstehen",
				"nice-to-have",
			);
		}
	}

	// Länge
	if (parsed.content.length >= MIN_CONTENT_LENGTH) {
		score += POINTS.length;
	} else {
		addIssue(
			issues,
			`llms.txt ist sehr kurz (${parsed.content.length} Zeichen) — eine ausführlichere Beschreibung verbessert die KI-Sichtbarkeit`,
			"nice-to-have",
		);
	}

	// Kein HTML
	if (!parsed.hasHtmlTags) {
		score += POINTS.noHtml;
	} else {
		addIssue(
			issues,
			"llms.txt enthält HTML-Code — die Spezifikation verlangt reines Textformat",
			"nice-to-have",
		);
	}

	return { score: Math.min(100, score), issues };
}

// ── Check implementation ─────────────────────────────────────

function lookupLlmsTxt(ctx: CheckContext): { content: string; source: string } | null {
	const primary = ctx.subResources["/llms.txt"];
	if (primary) return { content: primary.content, source: primary.source };
	const fallback = ctx.subResources["/llms-full.txt"];
	if (fallback) return { content: fallback.content, source: fallback.source };
	return null;
}

const META = CHECK_METADATA_MAP["llms-txt"];

const llmsTxtCheck: CheckPlugin = {
	...META,

	async run(ctx: CheckContext): Promise<ScanCheck> {
		const fetchResult = lookupLlmsTxt(ctx);

		// File not found
		if (!fetchResult) {
			return {
				...META,
				status: "fail",
				score: 0,
				summary:
					"Keine llms.txt gefunden — KI-Systeme wie ChatGPT, Perplexity und Claude können Ihr Unternehmen nicht strukturiert erfassen",
				issues: [{ message: "Weder /llms.txt noch /llms-full.txt gefunden", severity: "critical" }],
			};
		}

		// Soft-404 detection: server returned HTML instead of Markdown
		if (isHtmlResponse(fetchResult.content)) {
			return {
				...META,
				status: "fail",
				score: 0,
				summary: "Unter /llms.txt wird eine HTML-Seite ausgeliefert statt einer Textformat-Datei",
				issues: [
					{
						message:
							"Der Server liefert HTML statt einer llms.txt Textformat-Datei — möglicherweise eine Fehlerseite",
						severity: "critical",
					},
				],
			};
		}

		// Info: found via fallback
		const issues: ScanCheckIssue[] = [];
		if (fetchResult.source === "/llms-full.txt") {
			addIssue(
				issues,
				"Nur /llms-full.txt gefunden, aber /llms.txt fehlt — erstellen Sie eine kompakte Übersicht unter /llms.txt",
				"important",
			);
		}

		// Empty file
		if (fetchResult.content.trim().length === 0) {
			return {
				...META,
				status: "fail",
				score: POINTS.exists,
				summary: "llms.txt ist vorhanden aber leer",
				issues: [
					{
						message:
							"Die llms.txt Datei ist leer — fügen Sie Informationen über Ihr Unternehmen hinzu",
						severity: "critical",
					},
					...issues,
				],
			};
		}

		// Parse and score
		const parsed = parseLlmsTxt(fetchResult.content);
		const result = calculateScore(parsed);
		result.issues.unshift(...issues);

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
			pass: "llms.txt ist gut strukturiert und vollständig",
			warn: "llms.txt vorhanden, aber unvollständig",
			fail: "llms.txt ist vorhanden, enthält aber kaum nutzbare Informationen",
		};

		return {
			...META,
			status,
			score: result.score,
			summary: summaryMap[status],
			issues: result.issues,
			details: {
				source: fetchResult.source,
				contentLength: fetchResult.content.length,
				h1Count: parsed.h1Lines.length,
				h2Count: parsed.h2Sections.length,
				linkCount: parsed.markdownLinks.length,
				hasBlockquote: parsed.hasBlockquote,
			},
		};
	},
};

defaultRegistry.register(llmsTxtCheck);

export default llmsTxtCheck;
