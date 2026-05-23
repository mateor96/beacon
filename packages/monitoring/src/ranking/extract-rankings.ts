import type { BrandConfig, MentionResult } from "../extraction/types.js";
import { detectLists } from "./detect-lists.js";
import type { RankingOptions, RankingReport, RankingResult } from "./types.js";
import { DEFAULT_RANKING_OPTIONS } from "./types.js";

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findEntityInText(text: string, names: string[]): boolean {
	const lower = text.toLowerCase();
	return names.some((name) => {
		if (name.length <= 2) return lower === name.toLowerCase();
		return lower.includes(name.toLowerCase());
	});
}

function findEntityFirstOffset(text: string, names: string[]): number {
	const lowerText = text.toLowerCase();
	let earliest = -1;
	for (const name of names) {
		const idx = lowerText.indexOf(name.toLowerCase());
		if (idx !== -1 && (earliest === -1 || idx < earliest)) {
			earliest = idx;
		}
	}
	return earliest;
}

/**
 * Extracts ranking positions from AI response text.
 *
 * Two-phase approach:
 * 1. List detection (priority): finds numbered/bullet/headed lists, matches brand+competitors
 * 2. Mention-order fallback: uses first-appearance order of entities as rank
 *
 * Pure function — no I/O.
 */
export function extractRankings(
	text: string,
	brandConfig: BrandConfig,
	competitorKeywords: string[],
	mentions?: MentionResult[],
	options?: Partial<RankingOptions>,
): RankingReport {
	const startTime = performance.now();
	const opts = { ...DEFAULT_RANKING_OPTIONS, ...options };

	if (!text || text.trim().length === 0) {
		return { rankings: [], listDetected: false, durationMs: performance.now() - startTime };
	}

	// Phase A: List detection (priority)
	const lists = detectLists(text, opts);

	if (lists.length > 0) {
		// Use the highest-priority list
		const bestList = lists[0];
		const rankings: RankingResult[] = [];

		for (const item of bestList.items) {
			// Check if target brand appears in this list item
			if (findEntityInText(item.text, brandConfig.primaryNames)) {
				rankings.push({
					entityName: brandConfig.canonicalName,
					rankPosition: item.position,
					isTargetBrand: true,
					rankSource: "list",
					confidence: bestList.format === "numbered" || bestList.format === "top-n" ? 0.9 : 0.8,
				});
			}

			// Check competitors
			for (const competitor of competitorKeywords) {
				if (findEntityInText(item.text, [competitor])) {
					rankings.push({
						entityName: competitor,
						rankPosition: item.position,
						isTargetBrand: false,
						rankSource: "list",
						confidence: bestList.format === "numbered" || bestList.format === "top-n" ? 0.9 : 0.8,
					});
				}
			}
		}

		if (rankings.some((r) => r.isTargetBrand)) {
			return {
				rankings,
				listDetected: true,
				durationMs: performance.now() - startTime,
			};
		}
	}

	// Phase B: Mention-order fallback
	// Build entity → firstOffset map
	const entities: Array<{ name: string; offset: number; isTargetBrand: boolean }> = [];

	// Use pre-extracted mentions if available for brand position
	if (mentions && mentions.length > 0) {
		const brandMention = mentions.find((m) => m.brandName === brandConfig.canonicalName);
		if (brandMention) {
			entities.push({
				name: brandConfig.canonicalName,
				offset: brandMention.position,
				isTargetBrand: true,
			});
		}
	} else {
		// Find brand position manually
		const brandOffset = findEntityFirstOffset(text, brandConfig.primaryNames);
		if (brandOffset >= 0) {
			entities.push({
				name: brandConfig.canonicalName,
				offset: brandOffset,
				isTargetBrand: true,
			});
		}
	}

	// Find competitor positions
	for (const competitor of competitorKeywords) {
		const offset = findEntityFirstOffset(text, [competitor]);
		if (offset >= 0) {
			entities.push({
				name: competitor,
				offset,
				isTargetBrand: false,
			});
		}
	}

	// No brand found → no rankings
	if (!entities.some((e) => e.isTargetBrand)) {
		return { rankings: [], listDetected: false, durationMs: performance.now() - startTime };
	}

	// Sort by first-appearance offset and assign ordinal positions
	entities.sort((a, b) => a.offset - b.offset);

	const rankings: RankingResult[] = entities.map((e, i) => ({
		entityName: e.name,
		rankPosition: i + 1,
		isTargetBrand: e.isTargetBrand,
		rankSource: "mention-order" as const,
		confidence: 0.6,
	}));

	return {
		rankings,
		listDetected: false,
		durationMs: performance.now() - startTime,
	};
}
