// Boundary note: this check performs static HTML structure analysis.
// Semantic content meaning/quality is handled by the AI-based `semantic-quality` check.

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
	headingHierarchy: 25,
	semanticStructure: 20,
	contentDepth: 20,
	answerFirst: 20,
	headingQuality: 15,
} as const;

const STATUS_THRESHOLD_FAIL = 40;
const STATUS_THRESHOLD_PASS = 80;

// ── Interfaces ──────────────────────────────────────────────

interface ParsedContentStructure {
	headings: Array<{ level: number; text: string }>;
	h1Count: number;
	headingLevelSkips: number;
	distinctLevelsUsed: number;
	hasMain: boolean;
	articleCount: number;
	sectionCount: number;
	hasNav: boolean;
	hasHeaderOrFooter: boolean;
	paragraphCount: number;
	textToHtmlRatio: number;
	listCount: number;
	firstSubstantivePPosition: number | null;
	firstParagraphInMainOrArticle: boolean;
	totalDomNodes: number;
}

// ── Helpers ─────────────────────────────────────────────────

function addIssue(issues: ScanCheckIssue[], message: string, severity: CheckSeverity): void {
	issues.push({ message, severity });
}

// ── Parser ──────────────────────────────────────────────────

function parseContentStructure(parsedHtml: unknown): ParsedContentStructure {
	const root = parsedHtml as HTMLElement;

	// Headings
	const headingElements = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
	const headings = headingElements.map((el) => ({
		level: Number.parseInt(el.tagName.substring(1), 10),
		text: el.textContent.trim(),
	}));

	const h1Count = headings.filter((h) => h.level === 1).length;
	const distinctLevels = new Set(headings.map((h) => h.level));

	// Heading level skips (only penalize going DOWN, not back up)
	let headingLevelSkips = 0;
	for (let i = 1; i < headings.length; i++) {
		const prev = headings[i - 1].level;
		const next = headings[i].level;
		if (next > prev + 1) {
			headingLevelSkips++;
		}
	}

	// Semantic elements
	const hasMain = root.querySelectorAll("main").length > 0;
	const articleCount = root.querySelectorAll("article").length;
	const sectionCount = root.querySelectorAll("section").length;
	const hasNav = root.querySelectorAll("nav").length > 0;
	const hasHeaderOrFooter =
		root.querySelectorAll("header").length > 0 || root.querySelectorAll("footer").length > 0;

	// Content depth
	const paragraphCount = root.querySelectorAll("p").length;
	const htmlStr = root.toString();
	const textContent = root.textContent;
	const textToHtmlRatio = htmlStr.length < 50 ? 0 : textContent.length / htmlStr.length;
	const listCount = root.querySelectorAll("ul, ol").length;

	// Answer-first: find first substantive <p> excluding nav/header/footer
	const allParagraphs = root.querySelectorAll("p");
	let firstSubstantivePPosition: number | null = null;
	let firstParagraphInMainOrArticle = false;
	const totalDomNodes = root.querySelectorAll("*").length;

	for (let i = 0; i < allParagraphs.length; i++) {
		const p = allParagraphs[i];
		const text = p.textContent.trim();
		if (text.length < 50) continue;

		// Exclude <p> inside nav/header/footer
		let excluded = false;
		let parent = p.parentNode as HTMLElement | null;
		while (parent) {
			const tag = parent.tagName?.toLowerCase();
			if (tag === "nav" || tag === "header" || tag === "footer") {
				excluded = true;
				break;
			}
			parent = parent.parentNode as HTMLElement | null;
		}
		if (excluded) continue;

		// Found first substantive paragraph
		const allElements = root.querySelectorAll("*");
		const pIndex = allElements.indexOf(p);
		firstSubstantivePPosition = totalDomNodes > 0 ? pIndex / totalDomNodes : 0;

		// Check if inside main or article
		let ancestor = p.parentNode as HTMLElement | null;
		while (ancestor) {
			const tag = ancestor.tagName?.toLowerCase();
			if (tag === "main" || tag === "article") {
				firstParagraphInMainOrArticle = true;
				break;
			}
			ancestor = ancestor.parentNode as HTMLElement | null;
		}
		break;
	}

	return {
		headings,
		h1Count,
		headingLevelSkips,
		distinctLevelsUsed: distinctLevels.size,
		hasMain,
		articleCount,
		sectionCount,
		hasNav,
		hasHeaderOrFooter,
		paragraphCount,
		textToHtmlRatio,
		listCount,
		firstSubstantivePPosition,
		firstParagraphInMainOrArticle,
		totalDomNodes,
	};
}

// ── Score calculation ───────────────────────────────────────

function calculateScore(parsed: ParsedContentStructure): {
	score: number;
	issues: ScanCheckIssue[];
} {
	const issues: ScanCheckIssue[] = [];
	let score = 0;

	// 1. Heading Hierarchy (25 points)
	// H1 presence (8pts)
	if (parsed.h1Count === 1) {
		score += 8;
	} else if (parsed.h1Count === 0) {
		addIssue(
			issues,
			"Kein Haupttitel (H1) gefunden — KI-Systeme können das Hauptthema nicht erkennen",
			"critical",
		);
	} else {
		score += 4;
		addIssue(
			issues,
			`${parsed.h1Count} Haupttitel (H1) gefunden — es sollte genau einer vorhanden sein`,
			"important",
		);
	}

	// No heading level skips (10pts)
	score += Math.max(0, 10 - parsed.headingLevelSkips * 3);
	if (parsed.headingLevelSkips > 0) {
		addIssue(
			issues,
			`${parsed.headingLevelSkips} Überschriften-Ebenenwechsel übersprungen — Überschriften sollten hierarchisch aufgebaut sein`,
			"important",
		);
	}

	// 2+ heading levels used (7pts)
	if (parsed.headings.length === 0) {
		// no points, no additional issue (already covered by H1 check)
	} else if (parsed.distinctLevelsUsed >= 2) {
		score += 7;
	} else {
		score += 3;
	}

	// 2. Semantic Structure (20 points)
	if (parsed.hasMain) {
		score += 8;
	} else {
		addIssue(
			issues,
			"Kein Hauptinhaltsbereich (<main>) gefunden — Seitenstruktur fehlt",
			"important",
		);
	}

	if (parsed.articleCount + parsed.sectionCount > 0) {
		score += 6;
	} else {
		addIssue(
			issues,
			"Keine Inhaltsblöcke (<article>, <section>) gefunden — Inhalte sind nicht klar gegliedert",
			"nice-to-have",
		);
	}

	if (parsed.hasNav) {
		score += 3;
	}

	if (parsed.hasHeaderOrFooter) {
		score += 3;
	}

	// 3. Content Depth (20 points)
	if (parsed.paragraphCount >= 5) {
		score += 8;
	} else if (parsed.paragraphCount >= 3) {
		score += 5;
	} else if (parsed.paragraphCount >= 1) {
		score += 2;
	} else {
		addIssue(
			issues,
			"Keine Absätze gefunden — die Seite hat keinen strukturierten Textinhalt",
			"important",
		);
	}

	if (parsed.textToHtmlRatio >= 0.25) {
		score += 7;
	} else if (parsed.textToHtmlRatio >= 0.15) {
		score += 5;
	} else if (parsed.textToHtmlRatio >= 0.08) {
		score += 3;
	} else {
		if (parsed.paragraphCount > 0) {
			addIssue(
				issues,
				"Wenig sichtbarer Text im Verhältnis zum Seitencode — die Seite enthält wenig sichtbaren Text",
				"nice-to-have",
			);
		}
	}

	if (parsed.listCount >= 2) {
		score += 5;
	} else if (parsed.listCount === 1) {
		score += 3;
	}

	// 4. Answer First (20 points)
	if (parsed.firstSubstantivePPosition !== null) {
		const pos = parsed.firstSubstantivePPosition;
		if (pos <= 0.15) {
			score += 12;
		} else if (pos <= 0.3) {
			score += 8;
		} else if (pos <= 0.5) {
			score += 4;
		} else {
			addIssue(
				issues,
				"Hauptinhalt erscheint erst weit unten auf der Seite — Wichtige Inhalte sollten oben stehen",
				"important",
			);
		}

		if (parsed.firstParagraphInMainOrArticle) {
			score += 8;
		} else {
			addIssue(
				issues,
				"Erster Absatz befindet sich nicht in <main> oder <article>",
				"nice-to-have",
			);
		}
	}
	// If no substantive <p> found: 0 points for both sub-scores (implicit)

	// 5. Heading Quality (15 points)
	if (parsed.headings.length === 0) {
		// Guard: no headings → 0 points
	} else {
		// Avg heading text length (8pts)
		const avgLen =
			parsed.headings.reduce((sum, h) => sum + h.text.length, 0) / parsed.headings.length;
		if (avgLen >= 15) {
			score += 8;
		} else if (avgLen >= 8) {
			score += 5;
		} else {
			score += 2;
			addIssue(
				issues,
				"Überschriften sind zu kurz — beschreibende Überschriften helfen KI-Systemen",
				"nice-to-have",
			);
		}

		// Unique headings (7pts)
		const normalized = parsed.headings.map((h) => h.text.toLowerCase());
		const duplicateCount = normalized.length - new Set(normalized).size;
		score += Math.max(0, 7 - duplicateCount * 2);
		if (duplicateCount > 0) {
			addIssue(
				issues,
				`${duplicateCount} doppelte Überschriften gefunden — jede Überschrift sollte einzigartig sein`,
				"nice-to-have",
			);
		}
	}

	return { score: Math.min(100, score), issues };
}

// ── Check implementation ────────────────────────────────────

const SUMMARY_MAP = {
	pass: "Content-Struktur ist gut organisiert — klare Überschriften-Hierarchie und klare Seitengliederung für KI-Systeme.",
	warn: "Content-Struktur teilweise vorhanden — Überschriften oder Strukturelemente fehlen teilweise.",
	fail: "Mangelhafte Content-Struktur — KI-Systeme können den Inhalt nicht effektiv verarbeiten.",
};

const META = CHECK_METADATA_MAP["content-structure"];

const contentStructureCheck: CheckPlugin = {
	...META,

	async run(ctx: CheckContext): Promise<ScanCheck> {
		const parsed = parseContentStructure(ctx.parsedHtml);
		const result = calculateScore(parsed);

		let status: "pass" | "warn" | "fail";
		if (result.score < STATUS_THRESHOLD_FAIL) {
			status = "fail";
		} else if (result.score < STATUS_THRESHOLD_PASS) {
			status = "warn";
		} else {
			status = "pass";
		}

		const headingLevels = [...new Set(parsed.headings.map((h) => h.level))].sort();
		const h1Heading = parsed.headings.find((h) => h.level === 1);

		return {
			...META,
			status,
			score: result.score,
			summary: SUMMARY_MAP[status],
			issues: result.issues,
			details: {
				h1Count: parsed.h1Count,
				h1Text: h1Heading?.text ?? null,
				headingCount: parsed.headings.length,
				headingLevels,
				headingHierarchyValid: parsed.headingLevelSkips === 0 && parsed.h1Count === 1,
				hasMain: parsed.hasMain,
				hasArticle: parsed.articleCount > 0,
				hasSection: parsed.sectionCount > 0,
				paragraphCount: parsed.paragraphCount,
				textToHtmlRatio: Math.round(parsed.textToHtmlRatio * 100) / 100,
				listCount: parsed.listCount,
			},
		};
	},
};

defaultRegistry.register(contentStructureCheck);

export default contentStructureCheck;
export { parseContentStructure, calculateScore, type ParsedContentStructure };
