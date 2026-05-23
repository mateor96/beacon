/**
 * Canned scan results for E2E tests.
 *
 * When E2E_STUB_SCAN=true, the scan processor returns these results
 * instead of fetching external URLs and running scanner checks.
 * This makes E2E tests deterministic and independent of external networks.
 *
 * Note: semantic-quality and citation-readiness are assigned to "transactional"
 * category here (diverging from real CHECK_METADATA_MAP where they are "readability")
 * because the E2E tests assert that all 3 category bars are visible.
 */

import type { ScanCheck } from "@beacon/shared";

export const E2E_STUB_CHECKS: ScanCheck[] = [
	{
		id: "llms-txt",
		name: "llms.txt",
		category: "readability",
		status: "pass",
		score: 100,
		severity: "important",
		issues: [],
		summary: "llms.txt found",
	},
	{
		id: "robots-txt",
		name: "robots.txt",
		category: "readability",
		status: "pass",
		score: 100,
		severity: "important",
		issues: [],
		summary: "robots.txt found",
	},
	{
		id: "sitemap-xml",
		name: "Sitemap XML",
		category: "readability",
		status: "pass",
		score: 85,
		severity: "important",
		issues: [],
		summary: "sitemap.xml found",
	},
	{
		id: "schema-org",
		name: "Schema.org",
		category: "readability",
		status: "warn",
		score: 50,
		severity: "important",
		issues: [{ message: "Missing Organization schema", severity: "important" }],
		summary: "Partial schema found",
	},
	{
		id: "content-structure",
		name: "Content Structure",
		category: "readability",
		status: "pass",
		score: 80,
		severity: "important",
		issues: [],
		summary: "Good structure",
	},
	{
		id: "performance",
		name: "Performance",
		category: "interactivity",
		status: "pass",
		score: 90,
		severity: "critical",
		issues: [],
		summary: "Good performance",
	},
	{
		id: "meta-tags",
		name: "Meta Tags",
		category: "readability",
		status: "pass",
		score: 100,
		severity: "important",
		issues: [],
		summary: "All meta tags present",
	},
	{
		id: "webmcp",
		name: "WebMCP",
		category: "interactivity",
		status: "fail",
		score: 0,
		severity: "nice-to-have",
		issues: [{ message: "No WebMCP endpoint found", severity: "nice-to-have" }],
		summary: "Not implemented",
	},
	{
		id: "agents-md",
		name: "agents.md",
		category: "interactivity",
		status: "fail",
		score: 0,
		severity: "nice-to-have",
		issues: [{ message: "No agents.md found", severity: "nice-to-have" }],
		summary: "Not found",
	},
	{
		id: "semantic-quality",
		name: "Semantic Quality",
		category: "transactional",
		status: "pass",
		score: 75,
		severity: "important",
		issues: [],
		summary: "Good semantic quality",
	},
	{
		id: "citation-readiness",
		name: "Citation Readiness",
		category: "transactional",
		status: "warn",
		score: 60,
		severity: "important",
		issues: [{ message: "Missing citation metadata", severity: "important" }],
		summary: "Partial citation readiness",
	},
	{
		id: "content-freshness",
		name: "Aktualitätssignale",
		category: "readability",
		status: "pass",
		score: 75,
		severity: "important",
		issues: [],
		summary: "Freshness signals found",
	},
	{
		id: "faq-schema",
		name: "FAQ & Anleitungen",
		category: "readability",
		status: "warn",
		score: 0,
		severity: "important",
		issues: [{ message: "No FAQ schema", severity: "important" }],
		summary: "No FAQ data",
	},
	{
		id: "js-rendering",
		name: "JS-Rendering / SSR",
		category: "readability",
		status: "pass",
		score: 90,
		severity: "critical",
		issues: [],
		summary: "SSR detected",
	},
];

export const E2E_STUB_LEVEL_SCORES = {
	readability: 82,
	interactivity: 45,
	transactional: 67,
};

export const E2E_STUB_SCORE = 65;
export const E2E_STUB_READINESS_LEVEL = 2;
