import type {
	CheckContext,
	CheckPlugin,
	CheckSeverity,
	ScanCheck,
	ScanCheckIssue,
} from "@beacon/shared";
import { CHECK_METADATA_MAP, isHtmlResponse } from "@beacon/shared";

import { defaultRegistry } from "../registry.js";

// ── AI Bot Classification ───────────────────────────────────

const PRIMARY_BOTS = [
	"GPTBot",
	"ChatGPT-User",
	"ClaudeBot",
	"Claude-Web",
	"PerplexityBot",
	"Google-Extended",
] as const;

const SECONDARY_BOTS = ["Googlebot", "Bingbot"] as const;

// ── Scoring weights ─────────────────────────────────────────

const POINTS = {
	exists: 10,
	validSyntax: 10,
	hasAiDirectives: 15,
	primaryAllowed: 30,
	secondaryAllowed: 10,
	sitemapPresent: 10,
	noGlobalBlock: 15,
} as const;

const STATUS_THRESHOLD_FAIL = 40;
const STATUS_THRESHOLD_PASS = 80;

// RFC 9309: missing robots.txt = full access granted. Score in "warn" range
// (above fail threshold) because the site is accessible but lacks explicit AI rules.
const SCORE_MISSING = 55;

// ── Interfaces ──────────────────────────────────────────────

interface UserAgentBlock {
	userAgents: string[];
	disallowRules: string[];
	allowRules: string[];
	crawlDelay?: number;
}

interface ParsedRobotsTxt {
	blocks: UserAgentBlock[];
	sitemaps: string[];
	globalBlock: UserAgentBlock | null;
	blanketDisallow: boolean;
	aiBots: Record<string, "allowed" | "blocked" | "unspecified">;
	syntaxValid: boolean;
	malformedLineCount: number;
	duplicateUserAgents: string[];
}

// ── Parser ──────────────────────────────────────────────────

const DIRECTIVE_RE = /^(user-agent|disallow|allow|crawl-delay|sitemap)\s*:\s*(.*)/i;

function parseRobotsTxt(content: string): ParsedRobotsTxt {
	const lines = content.replace(/\r\n|\r/g, "\n").split("\n");

	const blocks: UserAgentBlock[] = [];
	const sitemaps: string[] = [];
	let malformedLineCount = 0;
	let totalDirectiveLines = 0;

	let currentUAs: string[] = [];
	let currentBlock: Omit<UserAgentBlock, "userAgents"> | null = null;

	function flushBlock() {
		if (currentUAs.length > 0 && currentBlock) {
			blocks.push({
				userAgents: currentUAs,
				...currentBlock,
			});
		}
		currentUAs = [];
		currentBlock = null;
	}

	for (const rawLine of lines) {
		// Strip inline comments
		const commentIdx = rawLine.indexOf(" #");
		const line = (commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine).trim();

		if (line === "" || line.startsWith("#")) continue;

		totalDirectiveLines++;

		const match = DIRECTIVE_RE.exec(line);
		if (!match) {
			malformedLineCount++;
			continue;
		}

		const directive = match[1].toLowerCase();
		const value = match[2].trim();

		if (directive === "sitemap") {
			sitemaps.push(value);
			continue;
		}

		if (directive === "user-agent") {
			if (currentBlock) {
				// We were in a non-UA directive block, flush and start new
				flushBlock();
			}
			if (!currentBlock) {
				currentBlock = { disallowRules: [], allowRules: [] };
			}
			currentUAs.push(value.toLowerCase());
			continue;
		}

		// disallow, allow, crawl-delay — must be inside a block
		if (!currentBlock) {
			malformedLineCount++;
			continue;
		}

		if (directive === "disallow") {
			if (value !== "") {
				currentBlock.disallowRules.push(value);
			}
			// Empty Disallow: = allow all (RFC 9309)
		} else if (directive === "allow") {
			currentBlock.allowRules.push(value);
		} else if (directive === "crawl-delay") {
			const delay = Number.parseFloat(value);
			if (!Number.isNaN(delay)) {
				currentBlock.crawlDelay = delay;
			}
		}
	}

	flushBlock();

	// Detect duplicate user-agent entries across blocks (RFC 9309: first match wins)
	const uaCounts = new Map<string, number>();
	for (const block of blocks) {
		for (const ua of block.userAgents) {
			uaCounts.set(ua, (uaCounts.get(ua) ?? 0) + 1);
		}
	}
	const duplicateUserAgents = [...uaCounts.entries()]
		.filter(([, count]) => count > 1)
		.map(([ua]) => ua);

	// RFC 9309 §2.2.1: first matching group wins for wildcard
	const globalBlock = blocks.find((b) => b.userAgents.includes("*")) ?? null;
	const blanketDisallow =
		globalBlock?.disallowRules.includes("/") === true && !globalBlock.allowRules.includes("/");

	// Resolve AI bot status
	const allBots = [...PRIMARY_BOTS, ...SECONDARY_BOTS] as readonly string[];
	const aiBots: Record<string, "allowed" | "blocked" | "unspecified"> = {};

	for (const bot of allBots) {
		const botLower = bot.toLowerCase();
		// RFC 9309 §2.2.1: first matching specific group wins
		const specificBlock = blocks.find(
			(b) => !b.userAgents.includes("*") && b.userAgents.includes(botLower),
		);

		const effectiveBlock = specificBlock ?? globalBlock;

		if (!effectiveBlock) {
			aiBots[bot] = "unspecified";
		} else {
			const isBlocked =
				effectiveBlock.disallowRules.includes("/") && !effectiveBlock.allowRules.includes("/");
			aiBots[bot] = isBlocked ? "blocked" : "allowed";
		}
	}

	const syntaxValid = totalDirectiveLines === 0 || malformedLineCount / totalDirectiveLines < 0.3;

	return {
		blocks,
		sitemaps,
		globalBlock,
		blanketDisallow,
		aiBots,
		syntaxValid,
		malformedLineCount,
		duplicateUserAgents,
	};
}

// ── Helpers ─────────────────────────────────────────────────

function addIssue(issues: ScanCheckIssue[], message: string, severity: CheckSeverity): void {
	issues.push({ message, severity });
}

// ── Score calculation ───────────────────────────────────────

function calculateScore(parsed: ParsedRobotsTxt): {
	score: number;
	issues: ScanCheckIssue[];
} {
	const issues: ScanCheckIssue[] = [];
	let score = POINTS.exists;

	// validSyntax
	if (parsed.syntaxValid) {
		score += POINTS.validSyntax;
	} else {
		addIssue(
			issues,
			"robots.txt enthält fehlerhafte Zeilen — KI-Systeme könnten die Datei falsch interpretieren",
			"important",
		);
	}

	// hasAiDirectives — ≥1 primary bot in a specific (non-*) block
	const hasSpecificAiBlock = parsed.blocks.some(
		(b) =>
			!b.userAgents.includes("*") &&
			b.userAgents.some((ua) => PRIMARY_BOTS.some((bot) => bot.toLowerCase() === ua)),
	);
	if (hasSpecificAiBlock) {
		score += POINTS.hasAiDirectives;
	} else {
		addIssue(
			issues,
			"Keine spezifischen Regeln für KI-Systeme — KI-Systeme folgen nur den allgemeinen Regeln",
			"important",
		);
	}

	// primaryAllowed — 5 pts per primary bot NOT blocked
	let primaryAllowedCount = 0;
	for (const bot of PRIMARY_BOTS) {
		if (parsed.aiBots[bot] !== "blocked") {
			primaryAllowedCount++;
		} else {
			addIssue(
				issues,
				`${bot} ist durch robots.txt blockiert — dieses KI-System kann Ihre Inhalte nicht indexieren`,
				"critical",
			);
		}
	}
	score += primaryAllowedCount * 5;

	// secondaryAllowed — 5 pts per secondary bot NOT blocked
	let secondaryAllowedCount = 0;
	for (const bot of SECONDARY_BOTS) {
		if (parsed.aiBots[bot] !== "blocked") {
			secondaryAllowedCount++;
		} else {
			addIssue(
				issues,
				`${bot} ist durch robots.txt blockiert — dieses KI-System kann Ihre Inhalte nicht indexieren`,
				"critical",
			);
		}
	}
	score += secondaryAllowedCount * 5;

	// sitemapPresent
	if (parsed.sitemaps.length > 0) {
		score += POINTS.sitemapPresent;
	} else {
		addIssue(
			issues,
			"Kein Sitemap-Verweis in robots.txt — ein Sitemap-Link hilft KI-Systemen Ihre Inhalte effizient zu finden",
			"nice-to-have",
		);
	}

	// noGlobalBlock
	if (!parsed.blanketDisallow) {
		score += POINTS.noGlobalBlock;
	} else {
		addIssue(
			issues,
			"Globale Regel blockiert alle KI-Systeme (Disallow: /) — Ihre Website ist für KI-Systeme unsichtbar",
			"critical",
		);
	}

	// Warn about duplicate UA groups (ambiguous intent, only first group applies)
	if (parsed.duplicateUserAgents.length > 0) {
		const uaList = parsed.duplicateUserAgents.join(", ");
		addIssue(
			issues,
			`Doppelte User-Agent-Gruppen gefunden (${uaList}) — nur die erste Gruppe pro KI-System wird beachtet`,
			"nice-to-have",
		);
	}

	return { score: Math.min(100, score), issues };
}

// ── Check implementation ────────────────────────────────────

const META = CHECK_METADATA_MAP["robots-txt"];

const robotsTxtCheck: CheckPlugin = {
	...META,

	async run(ctx: CheckContext): Promise<ScanCheck> {
		const robotsTxtContent = ctx.subResources["/robots.txt"];

		// Not found (null or missing) — RFC 9309: missing robots.txt = full access granted
		if (!robotsTxtContent) {
			return {
				...META,
				status: "warn",
				score: SCORE_MISSING,
				summary: "robots.txt vorhanden, aber einige KI-Systeme sind eingeschränkt",
				issues: [
					{
						message:
							"Keine robots.txt gefunden — ohne robots.txt ist der Zugriff für alle KI-Systeme erlaubt, aber explizite Regeln für KI-Systeme werden empfohlen",
						severity: "important",
					},
				],
			};
		}

		const content = robotsTxtContent.content;

		// Soft-404
		if (isHtmlResponse(content)) {
			return {
				...META,
				status: "fail",
				score: 0,
				summary: "robots.txt blockiert wichtige KI-Systeme oder fehlt",
				issues: [
					{
						message: "Unter /robots.txt wird eine HTML-Seite ausgeliefert statt einer Textdatei",
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
				summary: "robots.txt blockiert wichtige KI-Systeme oder fehlt",
				issues: [
					{
						message: "robots.txt ist vorhanden aber leer — fügen Sie Regeln für KI-Systeme hinzu",
						severity: "critical",
					},
				],
			};
		}

		// Parse and score
		const parsed = parseRobotsTxt(content);
		const result = calculateScore(parsed);

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
			pass: "robots.txt erlaubt KI-Systemen den Zugriff auf Ihre Website",
			warn: "robots.txt vorhanden, aber einige KI-Systeme sind eingeschränkt",
			fail: "robots.txt blockiert wichtige KI-Systeme oder fehlt",
		};

		return {
			...META,
			status,
			score: result.score,
			summary: summaryMap[status],
			issues: result.issues,
			details: {
				sitemaps: parsed.sitemaps,
				blanketDisallow: parsed.blanketDisallow,
				aiBots: parsed.aiBots,
				syntaxValid: parsed.syntaxValid,
				malformedLineCount: parsed.malformedLineCount,
				blockCount: parsed.blocks.length,
				duplicateUserAgents: parsed.duplicateUserAgents,
			},
		};
	},
};

defaultRegistry.register(robotsTxtCheck);

export default robotsTxtCheck;
export { parseRobotsTxt, calculateScore, type ParsedRobotsTxt, type UserAgentBlock };
