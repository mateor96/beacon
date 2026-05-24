import type {
	CheckCategory,
	CheckId,
	CheckSeverity,
	PlanName,
	ReadinessLevel,
	ReadinessLevelName,
} from "./types.js";

// ── Check Metadata ───────────────────────────────────────────

export interface CheckMetadata {
	id: CheckId;
	name: string;
	category: CheckCategory;
	severity: CheckSeverity;
}

// ── Scoring ──────────────────────────────────────────────────

/** @deprecated Use CHECK_WEIGHTS for scoring. Retained for backward compatibility. */
export const SEVERITY_POINTS: Readonly<Record<CheckSeverity, number>> = Object.freeze({
	critical: 25,
	important: 10,
	"nice-to-have": 5,
});

// ── Check Weights (sum = 100) ───────────────────────────────
// Used by weighted-average scoring. Each weight reflects the check's
// importance for overall AI-readiness. Recalibration after real scan data planned.
//
// Scoring contract (Issue #46):
//   calculateOverallScore uses check.score (numeric 0-100), NOT check.status.
//   The status string ("pass"/"warn"/"fail") is purely informational (UI colors/labels).
//   A "warn" check with score=60 contributes exactly 60 × weight to the weighted average.
//   Thresholds: score < 40 → "fail", 40 ≤ score < 80 → "warn", score ≥ 80 → "pass".
//
// Empty categories (no checks registered) return null in levelScores, not MAX_SCORE.
// The "transactional" category intentionally has 0 checks in MVP scope (UCP/ACP
// deferred to Phase 6). Its levelScore is null = "not evaluated".
//
// Tier allocation (sum = 100):
//   Foundation (55): robots-txt(14), meta-tags(12), js-rendering(11), content-structure(10), sitemap-xml(7), performance(3)
//   Established (38): schema-org(10), semantic-quality(10), citation-readiness(8), content-freshness(5), faq-schema(5)
//   Advanced (7): llms-txt(7)
//   Info-only (0): webmcp(0), agents-md(0) — checks run but don't affect score
//
// Design: webmcp + agents-md are shown as "Future Readiness" info badges but have
// zero weight — they are emerging standards with ~0% adoption and should not penalize
// the score. A good corporate site scores ~70-80. AI-optimized sites score 85+.

export const CHECK_WEIGHTS: Readonly<Record<CheckId, number>> = Object.freeze({
	"robots-txt": 13,
	"sitemap-xml": 7,
	"llms-txt": 7,
	"schema-org": 10,
	"content-structure": 10,
	"semantic-quality": 10,
	"citation-readiness": 8,
	"content-freshness": 5,
	"faq-schema": 5,
	"meta-tags": 11,
	"js-rendering": 11,
	performance: 3,
	webmcp: 0,
	"agents-md": 0,
});

// ── Readiness Tier Grouping (Issue #151) ────────────────────
// Current Readiness: Foundation + Established checks (proven standards)
// Future Readiness: Advanced + Bleeding-edge checks (emerging AI standards)

export const CURRENT_READINESS_CHECK_IDS: readonly CheckId[] = Object.freeze([
	"robots-txt",
	"sitemap-xml",
	"meta-tags",
	"js-rendering",
	"content-structure",
	"performance",
	"schema-org",
	"semantic-quality",
	"citation-readiness",
	"content-freshness",
	"faq-schema",
] as CheckId[]);

export const FUTURE_READINESS_CHECK_IDS: readonly CheckId[] = Object.freeze([
	"llms-txt",
	"webmcp",
	"agents-md",
] as CheckId[]);

// ── Level Gate Checks ───────────────────────────────────────
// Hybrid level system: score threshold + required checks per level.
// A level is only reached if BOTH the score threshold AND all gate
// checks for that level (and all lower levels) score >= 50.

export const LEVEL_GATE_CHECKS: Readonly<Record<ReadinessLevel, readonly CheckId[]>> =
	Object.freeze({
		0: Object.freeze([] as CheckId[]),
		1: Object.freeze(["robots-txt"] as CheckId[]),
		2: Object.freeze(["robots-txt", "meta-tags"] as CheckId[]),
		3: Object.freeze([
			"robots-txt",
			"meta-tags",
			"llms-txt",
			"schema-org",
			"content-structure",
		] as CheckId[]),
	});

// ── Level Thresholds ─────────────────────────────────────────

export const LEVEL_THRESHOLDS: Readonly<Record<ReadinessLevel, number>> = Object.freeze({
	0: 20,
	1: 50,
	2: 75,
	3: 100,
});

export const LEVEL_NAMES: Readonly<Record<ReadinessLevel, ReadinessLevelName>> = Object.freeze({
	0: "Unsichtbar",
	1: "Lesbar",
	2: "Strukturiert",
	3: "Optimiert",
});

// ── Check Registry ───────────────────────────────────────────

export const CHECK_REGISTRY: readonly Readonly<CheckMetadata>[] = Object.freeze(
	(
		[
			{
				id: "llms-txt",
				name: "llms.txt (KI-Visitenkarte)",
				category: "readability",
				severity: "critical",
			},
			{
				id: "robots-txt",
				name: "robots.txt (Zugangsregeln für KI)",
				category: "readability",
				severity: "critical",
			},
			{
				id: "sitemap-xml",
				name: "Sitemap (Inhaltsverzeichnis)",
				category: "readability",
				severity: "important",
			},
			{
				id: "schema-org",
				name: "Strukturierte Daten (Schema.org)",
				category: "readability",
				severity: "important",
			},
			{
				id: "content-structure",
				name: "Content-Struktur",
				category: "readability",
				severity: "important",
			},
			{
				id: "performance",
				name: "Crawl-Effizienz",
				category: "readability",
				severity: "nice-to-have",
			},
			{
				id: "meta-tags",
				name: "Meta-Tags & Social-Vorschau",
				category: "readability",
				severity: "important",
			},
			{
				id: "webmcp",
				name: "KI-Agenten-Schnittstelle (MCP)",
				category: "interactivity",
				severity: "nice-to-have",
			},
			{
				id: "agents-md",
				name: "AGENTS.md (KI-Agenten-Anleitung)",
				category: "interactivity",
				severity: "nice-to-have",
			},
			{
				id: "semantic-quality",
				name: "Textqualität",
				category: "readability",
				severity: "important",
			},
			{
				id: "citation-readiness",
				name: "Zitierbarkeit",
				category: "readability",
				severity: "important",
			},
			{
				id: "content-freshness",
				name: "Aktualitätssignale",
				category: "readability",
				severity: "important",
			},
			{
				id: "faq-schema",
				name: "FAQ & Anleitungen (Schema)",
				category: "readability",
				severity: "important",
			},
			{
				id: "js-rendering",
				name: "Sichtbarkeit ohne JavaScript",
				category: "readability",
				severity: "critical",
			},
		] as const satisfies readonly CheckMetadata[]
	).map((entry) => Object.freeze(entry)),
);

export const CHECK_METADATA_MAP: Readonly<Record<CheckId, Readonly<CheckMetadata>>> = Object.freeze(
	Object.fromEntries(CHECK_REGISTRY.map((entry) => [entry.id, entry])) as Record<
		CheckId,
		Readonly<CheckMetadata>
	>,
);

// ── AI Crawlers ──────────────────────────────────────────────

export const AI_CRAWLERS = Object.freeze([
	"GPTBot",
	"ChatGPT-User",
	"ClaudeBot",
	"Claude-Web",
	"PerplexityBot",
	"Google-Extended",
	"Googlebot",
	"Bingbot",
	"FacebookExternalHit",
	"Twitterbot",
] as const);

export type AICrawler = (typeof AI_CRAWLERS)[number];

// ── TTL / Retention ─────────────────────────────────────────

export const PLAN_RETENTION_DAYS: Readonly<Record<PlanName, number>> = Object.freeze({
	free: 30,
	starter: 90,
	pro: 180,
	agency: 365,
	enterprise: 730,
});

// ── TTL / Retention ─────────────────────────────────────────

/** Hours before raw HTML content is eligible for purging (set to NULL, not row-delete). */
export const HTML_CONTENT_RETENTION_HOURS = 72;

// ── Anonymous Limits ─────────────────────────────────────────

export const ANONYMOUS_SCAN_DAILY_LIMIT = 3;

// ── Instance identity ────────────────────────────────────────

/**
 * Deterministic sentinel profile id for the single-tenant (anonymous)
 * instance. Some feature tables (e.g. `alerts.userId`) still carry a NOT NULL
 * FK to `profiles.id` from the multi-tenant era; operator-created rows use this
 * id. Seeded by `db:migrate` (see packages/db seed).
 */
export const INSTANCE_USER_ID = "00000000-0000-4000-8000-000000000001";

// ── Helpers ──────────────────────────────────────────────────

export const MAX_SCORE = 100;

export function scoreToLevel(score: number): ReadinessLevel {
	if (score <= 20) return 0;
	if (score <= 50) return 1;
	if (score <= 75) return 2;
	return 3;
}
