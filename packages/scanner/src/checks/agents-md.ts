import type {
	CheckContext,
	CheckPlugin,
	CheckSeverity,
	ScanCheck,
	ScanCheckIssue,
} from "@beacon/shared";
import { CHECK_METADATA_MAP, isHtmlResponse } from "@beacon/shared";

import { defaultRegistry } from "../registry.js";
import { type ParsedAgentsMd, parseAgentsMd } from "./agents-md-parser.js";

// ── Scoring weights ──────────────────────────────────────────

const POINTS = {
	exists: 15,
	hasTitle: 20,
	hasAgentDefs: 25,
	hasCapabilities: 15,
	hasContactInfo: 10,
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

function calculateScore(parsed: ParsedAgentsMd): { score: number; issues: ScanCheckIssue[] } {
	const issues: ScanCheckIssue[] = [];
	let score = POINTS.exists;

	// H1 title
	if (parsed.h1Lines.length === 1) {
		score += POINTS.hasTitle;
	} else if (parsed.h1Lines.length === 0) {
		addIssue(
			issues,
			"Kein Titel oder Haupttitel in AGENTS.md gefunden — KI-Agenten können den Zweck der Datei nicht erkennen",
			"important",
		);
	} else {
		score += Math.floor(POINTS.hasTitle / 2); // 10 partial
		addIssue(
			issues,
			`${parsed.h1Lines.length} Haupttitel gefunden — verwenden Sie genau einen Titel für die AGENTS.md`,
			"nice-to-have",
		);
	}

	// Agent definitions
	if (parsed.agentSectionCount > 0) {
		score += POINTS.hasAgentDefs;
	} else if (parsed.h2Sections.length > 0 || parsed.h3Sections.length > 0) {
		score += 12; // partial
		addIssue(
			issues,
			"Keine Agenten-Beschreibungen gefunden — listen Sie mindestens einen KI-Agenten mit seinen erlaubten Aktionen auf",
			"important",
		);
	} else {
		addIssue(
			issues,
			"Keine Agenten-Beschreibungen gefunden — listen Sie mindestens einen KI-Agenten mit seinen erlaubten Aktionen auf",
			"important",
		);
	}

	// Capabilities
	if (parsed.hasCapabilities) {
		score += POINTS.hasCapabilities;
	} else {
		addIssue(
			issues,
			"Keine Fähigkeiten beschrieben — KI-Agenten wissen nicht welche Aktionen sie ausführen dürfen",
			"important",
		);
	}

	// Contact info
	if (parsed.hasContactInfo) {
		score += POINTS.hasContactInfo;
	} else {
		addIssue(
			issues,
			"Keine Kontakt- oder Richtlinien-Informationen gefunden — fügen Sie eine Ansprechperson oder einen Richtlinien-Link hinzu",
			"nice-to-have",
		);
	}

	// Length
	if (parsed.contentLength >= MIN_CONTENT_LENGTH) {
		score += POINTS.length;
	} else {
		addIssue(
			issues,
			`AGENTS.md ist sehr kurz (${parsed.contentLength} Zeichen) — eine ausführlichere Beschreibung hilft KI-Agenten Ihre Schnittstellen zu verstehen`,
			"nice-to-have",
		);
	}

	// No HTML
	if (!parsed.hasHtmlTags) {
		score += POINTS.noHtml;
	} else {
		addIssue(
			issues,
			"AGENTS.md enthält HTML-Code — die Datei sollte reines Textformat sein",
			"nice-to-have",
		);
	}

	return { score: Math.min(100, score), issues };
}

// ── Lookup ───────────────────────────────────────────────────

function lookupAgentsMd(ctx: CheckContext): { content: string; source: string } | null {
	const primary = ctx.subResources["/.well-known/agents.md"];
	if (primary) return { content: primary.content, source: primary.source };
	const fallback = ctx.subResources["/agents.md"];
	if (fallback) return { content: fallback.content, source: fallback.source };
	return null;
}

// ── Check implementation ─────────────────────────────────────

const META = CHECK_METADATA_MAP["agents-md"];

const agentsMdCheck: CheckPlugin = {
	...META,

	async run(ctx: CheckContext): Promise<ScanCheck> {
		const fetchResult = lookupAgentsMd(ctx);

		// File not found
		if (!fetchResult) {
			return {
				...META,
				status: "fail",
				score: 0,
				summary: "Keine AGENTS.md gefunden oder Datei enthält kaum nutzbare Informationen",
				issues: [
					{
						message:
							"Keine AGENTS.md gefunden — KI-Agenten können nicht erkennen welche Interaktionen Ihre Website unterstützt",
						severity: "important",
					},
				],
			};
		}

		// Soft-404: HTML response
		if (isHtmlResponse(fetchResult.content)) {
			return {
				...META,
				status: "fail",
				score: 0,
				summary: "Keine AGENTS.md gefunden oder Datei enthält kaum nutzbare Informationen",
				issues: [
					{
						message:
							"Unter /AGENTS.md wird eine HTML-Seite ausgeliefert statt einer Textformat-Datei — möglicherweise eine Fehlerseite",
						severity: "important",
					},
				],
			};
		}

		const issues: ScanCheckIssue[] = [];

		// Fallback path info
		if (fetchResult.source === "/agents.md") {
			addIssue(
				issues,
				"AGENTS.md wurde nur unter /agents.md gefunden — der empfohlene Pfad ist /.well-known/agents.md",
				"nice-to-have",
			);
		}

		// Empty file
		if (fetchResult.content.trim().length === 0) {
			return {
				...META,
				status: "fail",
				score: POINTS.exists,
				summary: "Keine AGENTS.md gefunden oder Datei enthält kaum nutzbare Informationen",
				issues: [
					{
						message:
							"AGENTS.md ist vorhanden aber leer — beschreiben Sie die Fähigkeiten die KI-Agenten auf Ihrer Website nutzen können",
						severity: "important",
					},
					...issues,
				],
			};
		}

		// Parse and score
		const parsed = parseAgentsMd(fetchResult.content);
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
			pass: "AGENTS.md ist vorhanden und beschreibt KI-Agenten-Fähigkeiten für Ihre Website",
			warn: "AGENTS.md vorhanden, aber unvollständig — wichtige Angaben fehlen",
			fail: "Keine AGENTS.md gefunden oder Datei enthält kaum nutzbare Informationen",
		};

		return {
			...META,
			status,
			score: result.score,
			summary: summaryMap[status],
			issues: result.issues,
			details: {
				source: fetchResult.source,
				contentLength: parsed.contentLength,
				h1Count: parsed.h1Lines.length,
				sectionCount: parsed.h2Sections.length + parsed.h3Sections.length,
				agentSectionCount: parsed.agentSectionCount,
				hasCapabilities: parsed.hasCapabilities,
				hasContactInfo: parsed.hasContactInfo,
			},
		};
	},
};

defaultRegistry.register(agentsMdCheck);

export default agentsMdCheck;
