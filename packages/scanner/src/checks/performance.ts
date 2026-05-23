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

// ── Scoring weights ─────────────────────────────────────────

const POINTS = {
	htmlSize: 25,
	redirectCount: 15,
	domComplexity: 20,
	contentToNoiseRatio: 25,
	inlineCodeBloat: 15,
} as const;

const STATUS_THRESHOLD_FAIL = 40;
const STATUS_THRESHOLD_PASS = 80;

const KB = 1024;
const MB = 1024 * 1024;

// ── Interfaces ──────────────────────────────────────────────

interface ParsedPerformance {
	responseTimeMs: number;
	htmlSizeBytes: number;
	redirectCount: number;
	domNodeCount: number;
	largeInlineBlockCount: number;
	contentToNoiseRatio: number;
}

// ── Helpers ─────────────────────────────────────────────────

function addIssue(issues: ScanCheckIssue[], message: string, severity: CheckSeverity): void {
	issues.push({ message, severity });
}

function isElement(node: unknown): node is HTMLElement {
	return typeof node === "object" && node !== null && "querySelectorAll" in node && "clone" in node;
}

// ── Parser ──────────────────────────────────────────────────

function parsePerformance(ctx: CheckContext): ParsedPerformance {
	const root = ctx.parsedHtml as HTMLElement;

	// Response time
	const responseTimeMs = ctx.responseTime;

	// HTML size
	const htmlSizeBytes = Buffer.byteLength(ctx.html, "utf-8");

	// Redirects
	const redirectCount = ctx.redirects.length;

	// DOM complexity
	const domNodeCount = root.querySelectorAll("*").length;

	// Inline resources (scripts without src + styles with textContent > 500 chars)
	const inlineScripts = root.querySelectorAll("script:not([src])");
	const inlineStyles = root.querySelectorAll("style");
	let largeInlineBlockCount = 0;
	for (const el of inlineScripts) {
		if ((el.textContent?.length ?? 0) > 500) {
			largeInlineBlockCount++;
		}
	}
	for (const el of inlineStyles) {
		if ((el.textContent?.length ?? 0) > 500) {
			largeInlineBlockCount++;
		}
	}

	// Content-to-noise ratio
	let contentToNoiseRatio = 0;
	if (isElement(root) && htmlSizeBytes > 0) {
		const clone = parseHtml(root.outerHTML);
		for (const el of clone.querySelectorAll("script, style, noscript")) {
			el.remove();
		}
		const textContent = (clone.textContent ?? "").trim();
		const textBytes = Buffer.byteLength(textContent, "utf-8");
		contentToNoiseRatio = textBytes / htmlSizeBytes;
	}

	return {
		responseTimeMs,
		htmlSizeBytes,
		redirectCount,
		domNodeCount,
		largeInlineBlockCount,
		contentToNoiseRatio,
	};
}

// ── Score calculation ───────────────────────────────────────

function calculateScore(parsed: ParsedPerformance): {
	score: number;
	issues: ScanCheckIssue[];
} {
	const issues: ScanCheckIssue[] = [];
	let score = 0;

	// 1. HTML Size (25 points)
	const kb = Math.round(parsed.htmlSizeBytes / KB);
	if (parsed.htmlSizeBytes < 100 * KB) {
		score += POINTS.htmlSize;
	} else if (parsed.htmlSizeBytes < 500 * KB) {
		score += 18;
	} else if (parsed.htmlSizeBytes < 1 * MB) {
		score += 10;
		addIssue(
			issues,
			`Große HTML-Datei (${kb} KB) — KI-Systeme mit Token-Limits könnten Inhalte abschneiden`,
			"nice-to-have",
		);
	} else {
		addIssue(
			issues,
			`Sehr große HTML-Datei (${kb} KB) — die meisten KI-Systeme werden den Inhalt abschneiden`,
			"important",
		);
	}

	// 2. Redirect Count (15 points)
	if (parsed.redirectCount === 0) {
		score += POINTS.redirectCount;
	} else if (parsed.redirectCount === 1) {
		score += 12;
	} else if (parsed.redirectCount === 2) {
		score += 8;
		addIssue(
			issues,
			`${parsed.redirectCount} Weiterleitungen — jede Weiterleitung erhöht die Latenz und manche KI-Systeme brechen ab`,
			"nice-to-have",
		);
	} else {
		addIssue(
			issues,
			`${parsed.redirectCount} Weiterleitungen — zu viele Weiterleitungen verhindern den Zugriff durch KI-Systeme`,
			"important",
		);
	}

	// 3. DOM Complexity (20 points)
	if (parsed.domNodeCount < 1000) {
		score += POINTS.domComplexity;
	} else if (parsed.domNodeCount < 3000) {
		score += 15;
	} else if (parsed.domNodeCount < 5000) {
		score += 10;
		addIssue(
			issues,
			`Komplexe Seitenstruktur mit ${parsed.domNodeCount} Elementen — erzeugt mehr Rauschen für KI-Parser`,
			"nice-to-have",
		);
	} else {
		addIssue(
			issues,
			`Sehr komplexe Seitenstruktur mit ${parsed.domNodeCount} Elementen — KI-Systeme können Inhalte nicht effizient extrahieren`,
			"important",
		);
	}

	// 4. Content-to-Noise Ratio (25 points)
	const pct = Math.round(parsed.contentToNoiseRatio * 100);
	if (parsed.contentToNoiseRatio > 0.3) {
		score += POINTS.contentToNoiseRatio;
	} else if (parsed.contentToNoiseRatio > 0.15) {
		score += 18;
	} else if (parsed.contentToNoiseRatio > 0.08) {
		score += 10;
		addIssue(
			issues,
			`Niedriges Inhalt-zu-Code-Verhältnis (${pct}%) — KI-Systeme finden wenig verwertbaren Text`,
			"important",
		);
	} else {
		addIssue(
			issues,
			`Sehr niedriges Inhalt-zu-Code-Verhältnis (${pct}%) — der Großteil des HTML ist für KI-Systeme nicht verwertbar`,
			"critical",
		);
	}

	// 5. Inline Code Bloat (15 points)
	if (parsed.largeInlineBlockCount === 0) {
		score += POINTS.inlineCodeBloat;
	} else if (parsed.largeInlineBlockCount <= 3) {
		score += 10;
	} else if (parsed.largeInlineBlockCount <= 6) {
		score += 5;
		addIssue(
			issues,
			`${parsed.largeInlineBlockCount} große Inline-Code-Blöcke — eingebetteter Code verwässert den Inhalt für KI-Systeme`,
			"nice-to-have",
		);
	} else {
		addIssue(
			issues,
			`${parsed.largeInlineBlockCount} große Inline-Code-Blöcke — massive Code-Aufblähung erschwert die Inhaltsextraktion`,
			"important",
		);
	}

	return { score: Math.min(100, score), issues };
}

// ── Check implementation ────────────────────────────────────

const META = CHECK_METADATA_MAP.performance;

const performanceCheck: CheckPlugin = {
	...META,

	async run(ctx: CheckContext): Promise<ScanCheck> {
		const parsed = parsePerformance(ctx);
		const result = calculateScore(parsed);

		let status: "pass" | "warn" | "fail";
		if (result.score < STATUS_THRESHOLD_FAIL) {
			status = "fail";
		} else if (result.score < STATUS_THRESHOLD_PASS) {
			status = "warn";
		} else {
			status = "pass";
		}

		const summaryMap = {
			pass: "Gute Crawl-Effizienz — die Seite ist kompakt und effizient für KI-Systeme verarbeitbar",
			warn: "Crawl-Effizienz verbesserungswürdig — einige Faktoren beeinträchtigen die Verarbeitung durch KI-Systeme",
			fail: "Schlechte Crawl-Effizienz — KI-Systeme haben erhebliche Schwierigkeiten, den Inhalt zu verarbeiten",
		};

		return {
			...META,
			status,
			score: result.score,
			summary: summaryMap[status],
			issues: result.issues,
			details: {
				responseTimeMs: parsed.responseTimeMs,
				htmlSizeKb: Math.round(parsed.htmlSizeBytes / KB),
				redirectCount: parsed.redirectCount,
				domNodeCount: parsed.domNodeCount,
				largeInlineBlockCount: parsed.largeInlineBlockCount,
				contentToNoiseRatio: Math.round(parsed.contentToNoiseRatio * 100) / 100,
				contentToNoisePercent: Math.round(parsed.contentToNoiseRatio * 100),
			},
		};
	},
};

defaultRegistry.register(performanceCheck);

export default performanceCheck;
export { parsePerformance, calculateScore, type ParsedPerformance };
