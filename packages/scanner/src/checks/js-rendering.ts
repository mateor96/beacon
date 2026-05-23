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
	contentPresence: 30,
	semanticElements: 20,
	ssrFramework: 15,
	scriptDependency: 15,
	noscriptFallback: 10,
	metaRendering: 10,
} as const;

const STATUS_THRESHOLD_FAIL = 40;
const STATUS_THRESHOLD_PASS = 80;

// ── Interfaces ──────────────────────────────────────────────

interface ParsedJsRendering {
	bodyTextLength: number;
	bodyWordCount: number;
	paragraphCount: number;
	hasH1: boolean;
	headingCount: number;
	hasMain: boolean;
	hasArticle: boolean;
	detectedFramework: string | null;
	ssrMarkers: string[];
	externalScriptCount: number;
	inlineScriptSize: number;
	totalHtmlSize: number;
	jsToContentRatio: number;
	hasNoscript: boolean;
	noscriptContentLength: number;
	hasTitle: boolean;
	hasMetaDescription: boolean;
	hasOgTags: boolean;
	hasCanonical: boolean;
	spaRootDetected: boolean;
	spaRootId: string | null;
}

// ── Type guard ──────────────────────────────────────────────

function isElement(node: unknown): node is HTMLElement {
	return node != null && typeof (node as HTMLElement).querySelectorAll === "function";
}

// ── Helpers ─────────────────────────────────────────────────

function addIssue(issues: ScanCheckIssue[], message: string, severity: CheckSeverity): void {
	issues.push({ message, severity });
}

// ── Framework detection ─────────────────────────────────────

const FRAMEWORK_MARKERS: Array<{ name: string; patterns: RegExp[] }> = [
	{
		name: "Next.js",
		patterns: [/__NEXT_DATA__/i, /_next\/static/i, /data-nscript/i],
	},
	{
		name: "Nuxt",
		patterns: [/__NUXT__/i, /__NUXT_DATA__/i, /_nuxt\//i],
	},
	{
		name: "Astro",
		patterns: [/data-astro-cid-/i, /astro-island/i],
	},
	{
		name: "Gatsby",
		patterns: [/___gatsby/i, /gatsby-/i],
	},
	{
		name: "Remix",
		patterns: [/__remixManifest/i, /data-remix/i],
	},
	{
		name: "SvelteKit",
		patterns: [/__sveltekit_/i, /svelte-/i],
	},
	{
		name: "Angular Universal",
		patterns: [/ng-version/i, /_nghost-/i, /_ngcontent-/i],
	},
];

const SPA_ROOT_IDS = ["root", "app", "__next", "__nuxt", "__vue_app", "___gatsby"];

// ── Parser ──────────────────────────────────────────────────

function parseJsRendering(parsedHtml: unknown, html: string): ParsedJsRendering {
	const root = parsedHtml as HTMLElement;
	const totalHtmlSize = html.length;

	// Defaults for non-element roots
	if (!isElement(root)) {
		return {
			bodyTextLength: 0,
			bodyWordCount: 0,
			paragraphCount: 0,
			hasH1: false,
			headingCount: 0,
			hasMain: false,
			hasArticle: false,
			detectedFramework: null,
			ssrMarkers: [],
			externalScriptCount: 0,
			inlineScriptSize: 0,
			totalHtmlSize,
			jsToContentRatio: 1,
			hasNoscript: false,
			noscriptContentLength: 0,
			hasTitle: false,
			hasMetaDescription: false,
			hasOgTags: false,
			hasCanonical: false,
			spaRootDetected: false,
			spaRootId: null,
		};
	}

	// Body text (excluding script/style/noscript)
	const bodyEl = root.querySelector("body") ?? root;
	const clone = bodyEl.clone() as HTMLElement;
	if (isElement(clone)) {
		for (const tag of clone.querySelectorAll("script, style, noscript")) {
			tag.remove();
		}
	}
	const bodyText = (clone.textContent ?? "").replace(/\s+/g, " ").trim();
	const bodyTextLength = bodyText.length;
	const bodyWordCount =
		bodyText.length > 0 ? bodyText.split(/\s+/).filter((w) => w.length >= 2).length : 0;

	// Semantic elements
	const paragraphs = root.querySelectorAll("p");
	const meaningfulParagraphs = paragraphs.filter((p) => (p.textContent ?? "").trim().length > 20);
	const paragraphCount = meaningfulParagraphs.length;
	const hasH1 = root.querySelectorAll("h1").length > 0;
	const headingCount = root.querySelectorAll("h1, h2, h3, h4, h5, h6").length;
	const hasMain = root.querySelector("main") !== null;
	const hasArticle = root.querySelector("article") !== null;

	// Framework detection (use raw HTML for string matching)
	let detectedFramework: string | null = null;
	const ssrMarkers: string[] = [];
	for (const framework of FRAMEWORK_MARKERS) {
		for (const pattern of framework.patterns) {
			if (pattern.test(html)) {
				if (!detectedFramework) detectedFramework = framework.name;
				ssrMarkers.push(pattern.source);
				break;
			}
		}
	}

	// Script analysis
	const scripts = root.querySelectorAll("script");
	let externalScriptCount = 0;
	let inlineScriptSize = 0;
	for (const script of scripts) {
		if (script.getAttribute("src")) {
			externalScriptCount++;
		} else if (
			script.getAttribute("type") !== "application/ld+json" &&
			script.getAttribute("type") !== "application/json"
		) {
			inlineScriptSize += (script.textContent ?? "").length;
		}
	}

	const totalScriptSize = inlineScriptSize + externalScriptCount * 20_000; // estimate 20KB per external script
	const jsToContentRatio = totalHtmlSize > 0 ? totalScriptSize / totalHtmlSize : 0;

	// Noscript
	const noscriptEls = root.querySelectorAll("noscript");
	let noscriptContentLength = 0;
	for (const el of noscriptEls) {
		noscriptContentLength += (el.textContent ?? "").trim().length;
	}
	const hasNoscript = noscriptEls.length > 0;

	// Meta rendering
	const hasTitle =
		root.querySelector("title") !== null &&
		(root.querySelector("title")?.textContent ?? "").trim().length > 0;
	const hasMetaDescription =
		(root.querySelector('meta[name="description"]')?.getAttribute("content")?.trim().length ?? 0) >
		0;
	const hasOgTags = root.querySelector('meta[property="og:title"]') !== null;
	const hasCanonical = root.querySelector('link[rel="canonical"]') !== null;

	// SPA root detection
	let spaRootDetected = false;
	let spaRootId: string | null = null;
	for (const id of SPA_ROOT_IDS) {
		const el = root.querySelector(`#${id}`);
		if (el && (el.textContent ?? "").trim().length < 30) {
			spaRootDetected = true;
			spaRootId = id;
			break;
		}
	}
	// Also check for custom element roots (Angular)
	const appRoot = root.querySelector("app-root");
	if (appRoot && (appRoot.textContent ?? "").trim().length < 30) {
		spaRootDetected = true;
		spaRootId = "app-root";
	}

	return {
		bodyTextLength,
		bodyWordCount,
		paragraphCount,
		hasH1,
		headingCount,
		hasMain,
		hasArticle,
		detectedFramework,
		ssrMarkers,
		externalScriptCount,
		inlineScriptSize,
		totalHtmlSize,
		jsToContentRatio,
		hasNoscript,
		noscriptContentLength,
		hasTitle,
		hasMetaDescription,
		hasOgTags,
		hasCanonical,
		spaRootDetected,
		spaRootId,
	};
}

// ── Score calculation ───────────────────────────────────────

function calculateScore(parsed: ParsedJsRendering): {
	score: number;
	issues: ScanCheckIssue[];
	renderingType: string;
} {
	const issues: ScanCheckIssue[] = [];
	let score = 0;

	// 1. Content Presence (30 points)
	if (parsed.bodyWordCount >= 100) {
		score += 30;
	} else if (parsed.bodyWordCount >= 50) {
		score += 22;
	} else if (parsed.bodyWordCount >= 20) {
		score += 15;
	} else if (parsed.bodyWordCount >= 5) {
		score += 8;
	} else {
		addIssue(
			issues,
			"Kein sichtbarer Textinhalt im HTML — KI-Systeme ohne JavaScript-Unterstützung sehen eine leere Seite",
			"critical",
		);
	}

	if (parsed.bodyWordCount > 0 && parsed.bodyWordCount < 50) {
		addIssue(
			issues,
			`Sehr wenig Textinhalt im rohen HTML (${parsed.bodyWordCount} Wörter) — die meisten Inhalte werden vermutlich per JavaScript im Browser nachgeladen`,
			"important",
		);
	}

	// 2. Semantic Elements (20 points)
	let semanticScore = 0;
	if (parsed.hasH1) semanticScore += 5;
	if (parsed.headingCount >= 2) semanticScore += 4;
	else if (parsed.headingCount >= 1) semanticScore += 2;
	if (parsed.hasMain || parsed.hasArticle) semanticScore += 5;
	if (parsed.paragraphCount >= 3) semanticScore += 6;
	else if (parsed.paragraphCount >= 1) semanticScore += 3;
	score += semanticScore;

	if (parsed.headingCount === 0 && parsed.paragraphCount === 0) {
		addIssue(
			issues,
			"Keine semantischen Elemente (Überschriften, Absätze) im HTML — der Seiteninhalt wird vollständig per JavaScript gerendert",
			"critical",
		);
	}

	// 3. SSR Framework Detection (15 points)
	if (parsed.detectedFramework && parsed.bodyWordCount >= 50) {
		score += 15;
	} else if (parsed.detectedFramework) {
		score += 8;
		addIssue(
			issues,
			`Server-Rendering-Framework erkannt (${parsed.detectedFramework}), aber der vorbereitete Inhalt ist begrenzt — möglicherweise werden wichtige Inhalte erst im Browser nachgeladen`,
			"important",
		);
	} else if (parsed.bodyWordCount >= 50) {
		score += 10;
	} else if (parsed.spaRootDetected) {
		addIssue(
			issues,
			"Kein Server-Rendering-Framework erkannt und kein vorbereiteter Inhalt — die Seite ist wahrscheinlich eine reine Browser-Anwendung (Single-Page-App)",
			"critical",
		);
	}

	// 4. Script Dependency (15 points — inverted: low JS ratio = good)
	// Only award points if there is actual content to serve
	if (parsed.bodyWordCount < 5) {
		// No content → script dependency is irrelevant
	} else if (parsed.externalScriptCount === 0 && parsed.inlineScriptSize < 500) {
		score += 15;
	} else if (parsed.detectedFramework && parsed.bodyWordCount >= 50) {
		// SSR framework with content = scripts are for hydration, not rendering
		score += 12;
	} else if (parsed.jsToContentRatio <= 0.3) {
		score += 12;
	} else if (parsed.jsToContentRatio <= 0.5) {
		score += 8;
	} else if (parsed.jsToContentRatio <= 0.8) {
		score += 4;
	}

	if (parsed.jsToContentRatio > 0.5 && parsed.bodyWordCount < 50) {
		addIssue(
			issues,
			"Hoher JavaScript-Anteil bei wenig sichtbarem Content — starke JavaScript-Abhängigkeit für die Inhaltsdarstellung",
			"important",
		);
	}

	// 5. Noscript Fallback (10 points)
	if (parsed.bodyWordCount >= 50) {
		score += 7;
	} else if (parsed.hasNoscript && parsed.noscriptContentLength >= 50) {
		score += 10;
	} else if (parsed.hasNoscript && parsed.noscriptContentLength > 0) {
		score += 5;
	} else if (!parsed.hasNoscript && parsed.bodyWordCount < 50) {
		addIssue(
			issues,
			"Kein Ersatzinhalt für deaktiviertes JavaScript vorhanden — Nutzer und KI-Systeme ohne JavaScript sehen keinen Inhalt",
			"important",
		);
	}

	// 6. Meta Rendering (10 points)
	if (parsed.hasTitle) score += 3;
	if (parsed.hasMetaDescription) score += 3;
	if (parsed.hasOgTags) score += 2;
	if (parsed.hasCanonical) score += 2;

	if (!parsed.hasTitle && !parsed.hasMetaDescription) {
		addIssue(
			issues,
			"Weder <title> noch Meta-Description im HTML vorhanden — Seitenbeschreibungen werden vermutlich per JavaScript gesetzt und sind für KI-Systeme unsichtbar",
			"important",
		);
	}

	// Determine rendering type
	let renderingType: string;
	if (parsed.externalScriptCount === 0 && parsed.inlineScriptSize < 500) {
		renderingType = "static";
	} else if (parsed.detectedFramework && parsed.bodyWordCount >= 50) {
		renderingType = "ssr";
	} else if (parsed.detectedFramework && parsed.bodyWordCount < 50) {
		renderingType = "partial-hydration";
	} else if (parsed.spaRootDetected && parsed.bodyWordCount < 30) {
		renderingType = "csr-spa";
	} else {
		renderingType = "unknown";
	}

	return { score: Math.min(100, score), issues, renderingType };
}

// ── Check implementation ────────────────────────────────────

const SUMMARY_MAP = {
	pass: "Inhalte sind serverseitig bereitgestellt und für KI-Systeme ohne JavaScript-Unterstützung vollständig zugänglich.",
	warn: "Teilweise serverseitig bereitgestellt — einige Inhalte könnten für KI-Systeme ohne JavaScript nicht sichtbar sein.",
	fail: "Inhalte sind stark JavaScript-abhängig — KI-Systeme ohne JavaScript-Unterstützung sehen wenig oder keinen Inhalt.",
};

const META = CHECK_METADATA_MAP["js-rendering"];

const jsRenderingCheck: CheckPlugin = {
	...META,

	async run(ctx: CheckContext): Promise<ScanCheck> {
		const parsed = parseJsRendering(ctx.parsedHtml, ctx.html);
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
				bodyTextLength: parsed.bodyTextLength,
				bodyWordCount: parsed.bodyWordCount,
				paragraphCount: parsed.paragraphCount,
				headingCount: parsed.headingCount,
				detectedFramework: parsed.detectedFramework,
				ssrMarkers: parsed.ssrMarkers,
				externalScriptCount: parsed.externalScriptCount,
				jsToContentRatio: Math.round(parsed.jsToContentRatio * 100) / 100,
				hasNoscript: parsed.hasNoscript,
				hasTitle: parsed.hasTitle,
				hasMetaDescription: parsed.hasMetaDescription,
				spaRootDetected: parsed.spaRootDetected,
				spaRootId: parsed.spaRootId,
				renderingType: result.renderingType,
			},
		};
	},
};

defaultRegistry.register(jsRenderingCheck);

export default jsRenderingCheck;
export { parseJsRendering, calculateScore, type ParsedJsRendering };
