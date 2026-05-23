import type {
	CheckContext,
	CheckPlugin,
	CheckSeverity,
	ScanCheck,
	ScanCheckIssue,
} from "@beacon/shared";
import { CHECK_METADATA_MAP } from "@beacon/shared";
import { type HTMLElement, parse as parseHtml } from "node-html-parser";
import { defaultRegistry } from "../registry.js";

// ── Scoring weights (100 total) ─────────────────────────────

const POINTS = {
	hasSchema: 20,
	validStructure: 20,
	contentQuality: 25,
	itemCount: 15,
	richContent: 10,
	crossReference: 10,
} as const;

const STATUS_THRESHOLD_FAIL = 40;
const STATUS_THRESHOLD_PASS = 80;

const META = CHECK_METADATA_MAP["faq-schema"];

// ── Interfaces ──────────────────────────────────────────────

interface FaqItem {
	question: string;
	answerText: string;
	answerLength: number;
}

interface HowToStep {
	name: string;
	text: string;
	textLength: number;
}

interface ParsedFaqSchema {
	hasFaqPage: boolean;
	hasHowTo: boolean;
	faqItems: FaqItem[];
	howToSteps: HowToStep[];
	howToName: string | null;
	invalidJson: boolean;
}

// ── Helpers ─────────────────────────────────────────────────

function isElement(node: unknown): node is HTMLElement {
	return node != null && typeof node === "object" && "querySelectorAll" in node;
}

function addIssue(issues: ScanCheckIssue[], message: string, severity: CheckSeverity): void {
	issues.push({ message, severity });
}

function matchesType(typeValue: unknown, target: string): boolean {
	const lowerTarget = target.toLowerCase();
	if (typeof typeValue === "string") {
		return typeValue.toLowerCase() === lowerTarget;
	}
	if (Array.isArray(typeValue)) {
		return typeValue.some((t) => typeof t === "string" && t.toLowerCase() === lowerTarget);
	}
	return false;
}

function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, "").trim();
}

// ── Parser ──────────────────────────────────────────────────

function parseFaqSchema(parsedHtml: unknown): ParsedFaqSchema {
	const root = parsedHtml as HTMLElement;

	let hasFaqPage = false;
	let hasHowTo = false;
	const faqItems: FaqItem[] = [];
	const howToSteps: HowToStep[] = [];
	let howToName: string | null = null;
	let invalidJson = false;

	if (!isElement(root)) {
		return { hasFaqPage, hasHowTo, faqItems, howToSteps, howToName, invalidJson };
	}

	const scripts = root.querySelectorAll('script[type="application/ld+json"]');
	const blocks: Record<string, unknown>[] = [];

	for (const script of scripts) {
		const text = script.textContent?.trim();
		if (!text) continue;

		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			invalidJson = true;
			continue;
		}

		if (Array.isArray(parsed)) {
			for (const item of parsed) {
				if (item && typeof item === "object" && !Array.isArray(item)) {
					blocks.push(item as Record<string, unknown>);
				}
			}
		} else if (parsed && typeof parsed === "object") {
			const obj = parsed as Record<string, unknown>;
			if (Array.isArray(obj["@graph"])) {
				for (const item of obj["@graph"] as unknown[]) {
					if (item && typeof item === "object" && !Array.isArray(item)) {
						blocks.push(item as Record<string, unknown>);
					}
				}
			} else {
				blocks.push(obj);
			}
		}
	}

	for (const block of blocks) {
		// FAQPage
		if (matchesType(block["@type"], "FAQPage")) {
			hasFaqPage = true;
			const mainEntity = block.mainEntity;
			if (Array.isArray(mainEntity)) {
				for (const item of mainEntity) {
					if (!item || typeof item !== "object") continue;
					const q = item as Record<string, unknown>;
					if (!matchesType(q["@type"], "Question")) continue;

					const question = typeof q.name === "string" ? q.name : "";
					let answerText = "";

					const accepted = q.acceptedAnswer;
					if (accepted && typeof accepted === "object") {
						const a = accepted as Record<string, unknown>;
						if (typeof a.text === "string") {
							answerText = a.text;
						}
					}

					faqItems.push({
						question,
						answerText,
						answerLength: stripHtml(answerText).length,
					});
				}
			}
		}

		// HowTo
		if (matchesType(block["@type"], "HowTo")) {
			hasHowTo = true;
			if (typeof block.name === "string") {
				howToName = block.name;
			}

			const steps = block.step;
			if (Array.isArray(steps)) {
				for (const s of steps) {
					if (!s || typeof s !== "object") continue;
					const step = s as Record<string, unknown>;
					if (!matchesType(step["@type"], "HowToStep")) continue;

					const name = typeof step.name === "string" ? step.name : "";
					const text = typeof step.text === "string" ? step.text : "";

					howToSteps.push({
						name,
						text,
						textLength: stripHtml(text).length,
					});
				}
			}
		}
	}

	return { hasFaqPage, hasHowTo, faqItems, howToSteps, howToName, invalidJson };
}

// ── Score calculation ───────────────────────────────────────

function calculateScore(
	parsed: ParsedFaqSchema,
	parsedHtml: unknown,
): {
	score: number;
	issues: ScanCheckIssue[];
	averageAnswerLength: number;
	qualityItemCount: number;
	hasRichContent: boolean;
	crossReferenceRatio: number;
} {
	const issues: ScanCheckIssue[] = [];
	let score = 0;
	let averageAnswerLength = 0;
	let qualityItemCount = 0;
	let hasRichContent = false;
	let crossReferenceRatio = 0;

	// 1. hasSchema (20 pts)
	if (!parsed.hasFaqPage && !parsed.hasHowTo) {
		addIssue(
			issues,
			"Keine FAQ- oder Anleitungs-Daten (Schema.org) gefunden \u2014 strukturierte Fragen und Antworten werden von KI-Systemen bevorzugt als direkte Antworten angezeigt",
			"important",
		);
		return {
			score: 0,
			issues,
			averageAnswerLength,
			qualityItemCount,
			hasRichContent,
			crossReferenceRatio,
		};
	}
	score += POINTS.hasSchema;

	// Combine items for scoring
	const allItems = [
		...parsed.faqItems.map((f) => ({ text: f.answerText, length: f.answerLength })),
		...parsed.howToSteps.map((s) => ({ text: s.text, length: s.textLength })),
	];
	const totalCount = allItems.length;

	// 2. validStructure (20 pts)
	if (totalCount > 0) {
		score += POINTS.validStructure;
	} else {
		score += 10;
		addIssue(
			issues,
			"FAQ-Schema vorhanden, aber keine Fragen und Antworten definiert \u2014 f\u00fcgen Sie mindestens 3 Frage-Antwort-Paare hinzu",
			"important",
		);
	}

	// 3. contentQuality (25 pts)
	if (totalCount > 0) {
		qualityItemCount = allItems.filter((item) => item.length > 50).length;
		const qualityScore = Math.floor((POINTS.contentQuality * qualityItemCount) / totalCount);
		score += qualityScore;

		if (qualityItemCount === 0) {
			addIssue(
				issues,
				"FAQ-Antworten sind zu kurz \u2014 ausf\u00fchrliche Antworten (mindestens 50 Zeichen) werden von KI-Systemen bevorzugt",
				"important",
			);
		}

		// Calculate average
		const totalLength = allItems.reduce((sum, item) => sum + item.length, 0);
		averageAnswerLength = Math.round(totalLength / totalCount);
	}

	// 4. itemCount (15 pts)
	if (totalCount >= 3) {
		score += POINTS.itemCount;
	} else if (totalCount === 2) {
		score += 10;
		addIssue(
			issues,
			"Nur 2 FAQ-Eintr\u00e4ge gefunden \u2014 mindestens 3 werden f\u00fcr optimale KI-Darstellung empfohlen",
			"nice-to-have",
		);
	} else if (totalCount === 1) {
		score += 5;
		addIssue(
			issues,
			"Nur 1 FAQ-Eintr\u00e4ge gefunden \u2014 mindestens 3 werden f\u00fcr optimale KI-Darstellung empfohlen",
			"nice-to-have",
		);
	}

	// 5. richContent (10 pts)
	if (totalCount > 0) {
		const richCount = allItems.filter((item) => item.text.includes("<")).length;
		if (richCount > totalCount / 2) {
			score += POINTS.richContent;
			hasRichContent = true;
		} else if (richCount > 0) {
			score += 5;
			hasRichContent = true;
		} else {
			addIssue(
				issues,
				"FAQ-Antworten enthalten nur einfachen Text \u2014 Formatierungen wie Links und Listen verbessern die Darstellung",
				"nice-to-have",
			);
		}
	}

	// 6. crossReference (10 pts)
	if (parsed.faqItems.length > 0 && isElement(parsedHtml)) {
		const root = parsedHtml as HTMLElement;
		// Get visible body text excluding script/style
		const body = root.querySelector("body");
		let visibleText = "";
		if (body) {
			const clone = parseHtml(body.outerHTML);
			for (const el of clone.querySelectorAll("script, style")) {
				el.remove();
			}
			visibleText = clone.textContent?.toLowerCase() ?? "";
		}

		if (visibleText) {
			const matchCount = parsed.faqItems.filter(
				(f) => f.question && visibleText.includes(f.question.toLowerCase()),
			).length;
			crossReferenceRatio = matchCount / parsed.faqItems.length;
			score += Math.floor(POINTS.crossReference * crossReferenceRatio);

			if (crossReferenceRatio === 0) {
				addIssue(
					issues,
					"FAQ-Inhalte stimmen nicht mit dem sichtbaren Seiteninhalt \u00fcberein \u2014 verwaiste Schema-Daten werden m\u00f6glicherweise ignoriert",
					"nice-to-have",
				);
			}
		}
	}

	return {
		score: Math.min(100, score),
		issues,
		averageAnswerLength,
		qualityItemCount,
		hasRichContent,
		crossReferenceRatio,
	};
}

// ── Check implementation ────────────────────────────────────

const SUMMARY_MAP = {
	pass: "FAQ/Anleitungs-Daten sind vollst\u00e4ndig und gut strukturiert f\u00fcr KI-Systeme.",
	warn: "FAQ-Daten vorhanden, aber unvollst\u00e4ndig \u2014 Qualit\u00e4t oder Umfang k\u00f6nnen verbessert werden.",
	fail: "Keine FAQ- oder Anleitungs-Daten gefunden \u2014 KI-Systeme k\u00f6nnen keine direkten Antworten extrahieren.",
};

const faqSchemaCheck: CheckPlugin = {
	...META,

	async run(ctx: CheckContext): Promise<ScanCheck> {
		const parsed = parseFaqSchema(ctx.parsedHtml);
		const result = calculateScore(parsed, ctx.parsedHtml);

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
				hasFaqPage: parsed.hasFaqPage,
				hasHowTo: parsed.hasHowTo,
				faqItemCount: parsed.faqItems.length,
				howToStepCount: parsed.howToSteps.length,
				howToName: parsed.howToName,
				averageAnswerLength: result.averageAnswerLength,
				qualityItemCount: result.qualityItemCount,
				hasRichContent: result.hasRichContent,
				crossReferenceRatio: result.crossReferenceRatio,
			},
		};
	},
};

defaultRegistry.register(faqSchemaCheck);

export default faqSchemaCheck;
export { parseFaqSchema, calculateScore, type ParsedFaqSchema };
