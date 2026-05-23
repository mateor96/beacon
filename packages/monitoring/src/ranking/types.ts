import type { BrandConfig, MentionResult } from "../extraction/types.js";

// ── List Detection ──────────────────────────────────────────

export const LIST_FORMATS = ["numbered", "bullet", "headed", "top-n"] as const;
export type ListFormat = (typeof LIST_FORMATS)[number];

export interface ListItem {
	/** 1-based position in the list. */
	position: number;
	/** Cleaned text content of the list item. */
	text: string;
	/** Character offset of the item in the original text. */
	charOffset: number;
}

export interface DetectedList {
	format: ListFormat;
	items: ListItem[];
	startOffset: number;
}

// ── Ranking Extraction ──────────────────────────────────────

export type RankSource = "list" | "mention-order";

export interface RankingResult {
	/** Canonical name of the ranked entity. */
	entityName: string;
	/** 1-based rank position. */
	rankPosition: number;
	/** Whether this is the target brand (true) or a competitor (false). */
	isTargetBrand: boolean;
	/** How the rank was determined. */
	rankSource: RankSource;
	/** Confidence in the ranking (0.9 for list, 0.6 for mention-order). */
	confidence: number;
}

export interface RankingReport {
	rankings: RankingResult[];
	listDetected: boolean;
	durationMs: number;
}

export interface RankingOptions {
	/** Minimum list items to qualify as a ranked list. Default: 3. */
	minListItems: number;
	/** Maximum list items to consider. Default: 20. */
	maxListItems: number;
}

export const DEFAULT_RANKING_OPTIONS: RankingOptions = {
	minListItems: 3,
	maxListItems: 20,
};

// ── Delta Calculation ───────────────────────────────────────

export interface DailyRankBucket {
	date: string;
	avgRank: number;
	dataPoints: number;
}

export interface RankingDelta {
	currentRank: number | null;
	delta1d: number | null;
	delta7d: number | null;
	delta30d: number | null;
}

export interface EngineRankingDelta {
	aiEngine: string;
	current: RankingDelta;
}

export interface AggregatedRankingDeltas {
	aggregated: RankingDelta;
	perEngine: EngineRankingDelta[];
}
