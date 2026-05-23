// Boundary note: this check performs rule-based text quality heuristics.
// Deep semantic analysis (clarity, uniqueness, etc.) is handled by the
// on-demand AI analysis in @beacon/ai pipeline.ts (analyzeSemanticQuality).

import type {
	CheckContext,
	CheckPlugin,
	CheckSeverity,
	ScanCheck,
	ScanCheckIssue,
} from "@beacon/shared";
import { CHECK_METADATA_MAP } from "@beacon/shared";
import type { HTMLElement as NHPElement } from "node-html-parser";
import { defaultRegistry } from "../registry.js";

// ── Type guard ──────────────────────────────────────────────

/** Ensure a node has querySelectorAll (is truly an HTMLElement, not a TextNode/CommentNode). */
function isElement(node: unknown): node is NHPElement {
	return node != null && typeof (node as NHPElement).querySelectorAll === "function";
}

// ── Scoring weights ─────────────────────────────────────────

const POINTS = {
	contentVolume: 15,
	paragraphQuality: 20,
	vocabularyRichness: 15,
	readability: 20,
	contentToBoilerplate: 15,
	contentSignals: 15,
} as const;

const STATUS_THRESHOLD_FAIL = 40;
const STATUS_THRESHOLD_PASS = 80;

// ── Stopwords (German + English) ────────────────────────────

const STOPWORDS = new Set([
	// German
	"der",
	"die",
	"das",
	"und",
	"in",
	"ist",
	"von",
	"den",
	"mit",
	"auf",
	"für",
	"ein",
	"eine",
	"einer",
	"einem",
	"einen",
	"eines",
	"nicht",
	"sich",
	"auch",
	"es",
	"an",
	"zu",
	"aus",
	"bei",
	"nach",
	"durch",
	"vor",
	"wie",
	"noch",
	"über",
	"oder",
	"aber",
	"dem",
	"werden",
	"wird",
	"hat",
	"haben",
	"sind",
	"war",
	"kann",
	"nur",
	"so",
	"sehr",
	"mehr",
	"wenn",
	"als",
	"man",
	"was",
	"ich",
	"wir",
	"sie",
	"er",
	// English
	"the",
	"and",
	"for",
	"are",
	"was",
	"not",
	"you",
	"all",
	"can",
	"had",
	"her",
	"one",
	"our",
	"out",
	"has",
	"its",
	"this",
	"that",
	"with",
	"from",
	"have",
	"been",
	"will",
	"your",
	"which",
	"their",
]);

// ── Interfaces ──────────────────────────────────────────────

interface ParsedSemanticQuality {
	wordCount: number;
	sentenceCount: number;
	paragraphCount: number;
	avgParagraphLength: number;
	paragraphLengthVariance: number;
	uniqueWordCount: number;
	typeTokenRatio: number;
	mostRepeatedWord: string | null;
	mostRepeatedWordRatio: number;
	avgSentenceLength: number;
	sentenceLengthVariety: number;
	questionCount: number;
	mainContentWordCount: number;
	boilerplateRatio: number;
	numberCount: number;
	longWordCount: number;
}

// ── Helpers ─────────────────────────────────────────────────

function addIssue(issues: ScanCheckIssue[], message: string, severity: CheckSeverity): void {
	issues.push({ message, severity });
}

function standardDeviation(values: number[]): number {
	if (values.length < 2) return 0;
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	const squaredDiffs = values.map((v) => (v - mean) ** 2);
	return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function extractTextFromElement(el: NHPElement): string {
	if (isElement(el)) {
		for (const tag of el.querySelectorAll("script, style, noscript")) {
			tag.remove();
		}
	}
	return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length >= 2 && /[a-zA-ZäöüÄÖÜß]/.test(w));
}

// ── Parser ──────────────────────────────────────────────────

function parseSemanticQuality(parsedHtml: unknown): ParsedSemanticQuality {
	const root = parsedHtml as NHPElement;

	// If parsedHtml is not a valid HTMLElement, return empty metrics
	if (!isElement(root)) {
		return {
			wordCount: 0,
			sentenceCount: 0,
			paragraphCount: 0,
			avgParagraphLength: 0,
			paragraphLengthVariance: 0,
			uniqueWordCount: 0,
			typeTokenRatio: 0,
			mostRepeatedWord: null,
			mostRepeatedWordRatio: 0,
			avgSentenceLength: 0,
			sentenceLengthVariety: 0,
			questionCount: 0,
			mainContentWordCount: 0,
			boilerplateRatio: 0,
			numberCount: 0,
			longWordCount: 0,
		};
	}

	// Clone root to avoid mutating the shared parsedHtml
	const clone = root.clone() as NHPElement | undefined;
	if (!clone || !isElement(clone)) {
		return {
			wordCount: 0,
			sentenceCount: 0,
			paragraphCount: 0,
			avgParagraphLength: 0,
			paragraphLengthVariance: 0,
			uniqueWordCount: 0,
			typeTokenRatio: 0,
			mostRepeatedWord: null,
			mostRepeatedWordRatio: 0,
			avgSentenceLength: 0,
			sentenceLengthVariety: 0,
			questionCount: 0,
			mainContentWordCount: 0,
			boilerplateRatio: 0,
			numberCount: 0,
			longWordCount: 0,
		};
	}

	// Full-page text (excluding script/style)
	const fullText = extractTextFromElement(clone);
	const allWords = tokenize(fullText);
	const wordCount = allWords.length;

	// Main-content text: prefer <main> or <article>, fallback to body minus boilerplate
	const mainClone = root.clone() as NHPElement | undefined;
	if (mainClone && isElement(mainClone)) {
		for (const tag of mainClone.querySelectorAll("script, style, noscript")) {
			tag.remove();
		}
	}

	let mainContentText: string;
	const mainEl =
		mainClone && isElement(mainClone)
			? (mainClone.querySelector("main") ?? mainClone.querySelector("article"))
			: null;
	if (mainEl) {
		mainContentText = mainEl.textContent.replace(/\s+/g, " ").trim();
	} else if (mainClone && isElement(mainClone)) {
		for (const tag of mainClone.querySelectorAll("nav, header, footer")) {
			tag.remove();
		}
		mainContentText = (mainClone.textContent ?? "").replace(/\s+/g, " ").trim();
	} else {
		mainContentText = "";
	}
	const mainContentWords = tokenize(mainContentText);
	const mainContentWordCount = mainContentWords.length;

	// Boilerplate ratio
	const boilerplateRatio = wordCount > 0 ? mainContentWordCount / wordCount : 0;

	// Paragraphs
	const paragraphs = isElement(root) ? root.querySelectorAll("p") : [];
	const paragraphWordCounts: number[] = [];
	for (const p of paragraphs) {
		const text = p.textContent.trim();
		if (text.length < 10) continue;
		const words = tokenize(text);
		if (words.length > 0) {
			paragraphWordCounts.push(words.length);
		}
	}
	const paragraphCount = paragraphWordCounts.length;
	const avgParagraphLength =
		paragraphCount > 0 ? paragraphWordCounts.reduce((a, b) => a + b, 0) / paragraphCount : 0;
	const paragraphLengthVariance = standardDeviation(paragraphWordCounts);

	// Sentences (split on sentence-ending punctuation)
	const sentences = mainContentText
		.split(/[.!?]+/)
		.map((s) => s.trim())
		.filter((s) => s.length > 10);
	const sentenceCount = sentences.length;
	const sentenceWordCounts = sentences.map((s) => tokenize(s).length).filter((c) => c > 0);
	const avgSentenceLength =
		sentenceWordCounts.length > 0
			? sentenceWordCounts.reduce((a, b) => a + b, 0) / sentenceWordCounts.length
			: 0;
	const sentenceLengthVariety = standardDeviation(sentenceWordCounts);
	const questionCount = (mainContentText.match(/\?/g) || []).length;

	// Vocabulary richness (on main content words, excluding stopwords)
	const contentWords = mainContentWords.filter((w) => !STOPWORDS.has(w));
	const uniqueWords = new Set(contentWords);
	const uniqueWordCount = uniqueWords.size;
	const typeTokenRatio = contentWords.length > 0 ? uniqueWordCount / contentWords.length : 0;

	// Most repeated non-stopword
	const wordFreq = new Map<string, number>();
	for (const w of contentWords) {
		wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
	}
	let mostRepeatedWord: string | null = null;
	let mostRepeatedWordRatio = 0;
	if (wordFreq.size > 0 && contentWords.length > 0) {
		let maxCount = 0;
		for (const [word, count] of wordFreq) {
			if (count > maxCount) {
				maxCount = count;
				mostRepeatedWord = word;
			}
		}
		mostRepeatedWordRatio = maxCount / contentWords.length;
	}

	// Content signals
	const numberCount = (mainContentText.match(/\b\d[\d.,]*\b/g) || []).length;
	const longWordCount = mainContentWords.filter((w) => w.length >= 10).length;

	return {
		wordCount,
		sentenceCount,
		paragraphCount,
		avgParagraphLength,
		paragraphLengthVariance,
		uniqueWordCount,
		typeTokenRatio,
		mostRepeatedWord,
		mostRepeatedWordRatio,
		avgSentenceLength,
		sentenceLengthVariety,
		questionCount,
		mainContentWordCount,
		boilerplateRatio,
		numberCount,
		longWordCount,
	};
}

// ── Score calculation ───────────────────────────────────────

function calculateScore(parsed: ParsedSemanticQuality): {
	score: number;
	issues: ScanCheckIssue[];
} {
	const issues: ScanCheckIssue[] = [];
	let score = 0;

	// 1. Content Volume (15 points)
	if (parsed.wordCount >= 300) {
		score += 10;
	} else if (parsed.wordCount >= 150) {
		score += 7;
	} else if (parsed.wordCount >= 50) {
		score += 4;
	} else {
		addIssue(
			issues,
			"Zu wenig Textinhalt — KI-Systeme benötigen mindestens 300 Wörter für eine sinnvolle Analyse",
			"critical",
		);
	}

	if (parsed.sentenceCount >= 10) {
		score += 5;
	} else if (parsed.sentenceCount >= 5) {
		score += 3;
	}

	// 2. Paragraph Quality (20 points)
	if (parsed.paragraphCount >= 5) {
		score += 7;
	} else if (parsed.paragraphCount >= 3) {
		score += 5;
	} else if (parsed.paragraphCount >= 1) {
		score += 2;
	} else {
		addIssue(issues, "Keine Absätze gefunden — Text ist nicht in Absätze gegliedert", "important");
	}

	if (parsed.avgParagraphLength >= 40 && parsed.avgParagraphLength <= 120) {
		score += 7;
	} else if (parsed.avgParagraphLength >= 20 && parsed.avgParagraphLength <= 200) {
		score += 5;
	} else if (parsed.paragraphCount > 0) {
		score += 2;
		if (parsed.avgParagraphLength < 20) {
			addIssue(
				issues,
				"Absätze sind zu kurz — ausführlichere Absätze verbessern die Textqualität",
				"nice-to-have",
			);
		}
	}

	if (parsed.paragraphLengthVariance > 15) {
		score += 6;
	} else if (parsed.paragraphLengthVariance > 5) {
		score += 4;
	} else if (parsed.paragraphCount > 1) {
		score += 2;
	}

	// 3. Vocabulary Richness (15 points)
	if (parsed.typeTokenRatio >= 0.6) {
		score += 10;
	} else if (parsed.typeTokenRatio >= 0.4) {
		score += 7;
	} else if (parsed.typeTokenRatio >= 0.2) {
		score += 4;
	} else if (parsed.wordCount > 0) {
		score += 2;
		addIssue(
			issues,
			"Geringer Wortschatz — der Text verwendet zu viele Wortwiederholungen",
			"important",
		);
	}

	if (parsed.mostRepeatedWordRatio < 0.03) {
		score += 5;
	} else if (parsed.mostRepeatedWordRatio < 0.06) {
		score += 3;
	} else if (parsed.wordCount > 0) {
		score += 1;
	}

	// 4. Readability (20 points)
	if (parsed.avgSentenceLength >= 10 && parsed.avgSentenceLength <= 25) {
		score += 8;
	} else if (parsed.avgSentenceLength >= 8 && parsed.avgSentenceLength <= 35) {
		score += 5;
	} else if (parsed.sentenceCount > 0) {
		score += 2;
		if (parsed.avgSentenceLength > 35) {
			addIssue(
				issues,
				"Zu lange Sätze — kürzere Sätze verbessern die Verständlichkeit für KI-Systeme",
				"important",
			);
		}
	}

	if (parsed.sentenceLengthVariety > 5) {
		score += 7;
	} else if (parsed.sentenceLengthVariety > 3) {
		score += 5;
	} else if (parsed.sentenceCount > 1) {
		score += 2;
	}

	if (parsed.questionCount >= 2) {
		score += 5;
	} else if (parsed.questionCount >= 1) {
		score += 3;
	}

	// 5. Content-to-Boilerplate Ratio (15 points)
	if (parsed.boilerplateRatio >= 0.6) {
		score += 15;
	} else if (parsed.boilerplateRatio >= 0.4) {
		score += 10;
	} else if (parsed.boilerplateRatio >= 0.2) {
		score += 5;
	} else if (parsed.wordCount > 0) {
		score += 2;
		addIssue(
			issues,
			"Zu viel Rahmeninhalt (Navigation, Footer etc.) im Verhältnis zum Hauptinhalt — KI-Systeme extrahieren wenig nützlichen Text",
			"important",
		);
	}

	// 6. Content Signals (15 points)
	if (parsed.numberCount >= 5) {
		score += 5;
	} else if (parsed.numberCount >= 2) {
		score += 3;
	}

	if (parsed.longWordCount >= 10) {
		score += 5;
	} else if (parsed.longWordCount >= 5) {
		score += 3;
	} else if (parsed.longWordCount >= 1) {
		score += 1;
	}

	// Remaining 5 points based on combined signal strength
	const signalScore = Math.min(5, Math.floor((parsed.numberCount + parsed.longWordCount) / 3));
	score += signalScore;

	return { score: Math.min(100, score), issues };
}

// ── Check implementation ────────────────────────────────────

const SUMMARY_MAP = {
	pass: "Hohe Textqualität — der Inhalt ist gut strukturiert, abwechslungsreich und informativ für KI-Systeme.",
	warn: "Mittlere Textqualität — einige Bereiche wie Wortschatz oder Absatzstruktur können verbessert werden.",
	fail: "Niedrige Textqualität — der Text ist zu dünn, repetitiv oder schlecht strukturiert für KI-Systeme.",
};

const META = CHECK_METADATA_MAP["semantic-quality"];

const semanticQualityCheck: CheckPlugin = {
	...META,

	async run(ctx: CheckContext): Promise<ScanCheck> {
		const parsed = parseSemanticQuality(ctx.parsedHtml);
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
				wordCount: parsed.wordCount,
				sentenceCount: parsed.sentenceCount,
				paragraphCount: parsed.paragraphCount,
				avgParagraphLength: Math.round(parsed.avgParagraphLength),
				typeTokenRatio: Math.round(parsed.typeTokenRatio * 100) / 100,
				avgSentenceLength: Math.round(parsed.avgSentenceLength * 10) / 10,
				boilerplateRatio: Math.round(parsed.boilerplateRatio * 100) / 100,
				numberCount: parsed.numberCount,
				questionCount: parsed.questionCount,
			},
		};
	},
};

defaultRegistry.register(semanticQualityCheck);

export default semanticQualityCheck;
export { parseSemanticQuality, calculateScore, type ParsedSemanticQuality };
