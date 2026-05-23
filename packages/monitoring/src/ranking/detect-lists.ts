import type { DetectedList, ListItem, RankingOptions } from "./types.js";
import { DEFAULT_RANKING_OPTIONS } from "./types.js";

// ── Regex Patterns ──────────────────────────────────────────

const NUMBERED_RE = /^[ \t]*(\d{1,3})[.)]\s+(.+)$/gm;
const BULLET_RE = /^[ \t]*[-*+]\s+(.+)$/gm;
const HEADED_RE = /^#{1,4}\s+(.+)$/gm;
const TOP_N_RE = /\b(?:top|best)\s+(\d{1,2})\b/i;

function stripMarkdown(text: string): string {
	return text
		.replace(/\*\*(.+?)\*\*/g, "$1")
		.replace(/\*(.+?)\*/g, "$1")
		.replace(/`(.+?)`/g, "$1")
		.replace(/\[(.+?)\]\(.+?\)/g, "$1")
		.trim();
}

// ── List Detection ──────────────────────────────────────────

function detectNumberedList(text: string): DetectedList | null {
	const items: ListItem[] = [];
	const regex = new RegExp(NUMBERED_RE.source, "gm");
	let match: RegExpExecArray | null = regex.exec(text);

	while (match !== null) {
		items.push({
			position: items.length + 1,
			text: stripMarkdown(match[2]),
			charOffset: match.index,
		});
		match = regex.exec(text);
	}

	return items.length > 0 ? { format: "numbered", items, startOffset: items[0].charOffset } : null;
}

function detectBulletList(text: string): DetectedList | null {
	const items: ListItem[] = [];
	const regex = new RegExp(BULLET_RE.source, "gm");
	let match: RegExpExecArray | null = regex.exec(text);

	while (match !== null) {
		items.push({
			position: items.length + 1,
			text: stripMarkdown(match[1]),
			charOffset: match.index,
		});
		match = regex.exec(text);
	}

	return items.length > 0 ? { format: "bullet", items, startOffset: items[0].charOffset } : null;
}

function detectHeadedList(text: string): DetectedList | null {
	const items: ListItem[] = [];
	const regex = new RegExp(HEADED_RE.source, "gm");
	let match: RegExpExecArray | null = regex.exec(text);

	while (match !== null) {
		items.push({
			position: items.length + 1,
			text: stripMarkdown(match[1]),
			charOffset: match.index,
		});
		match = regex.exec(text);
	}

	return items.length > 0 ? { format: "headed", items, startOffset: items[0].charOffset } : null;
}

function isTopNResponse(text: string): boolean {
	return TOP_N_RE.test(text);
}

/**
 * Detects all lists in AI response text.
 * Returns lists sorted by priority: numbered > top-n > bullet > headed.
 * Lists below minListItems are discarded.
 */
export function detectLists(text: string, options?: Partial<RankingOptions>): DetectedList[] {
	const opts = { ...DEFAULT_RANKING_OPTIONS, ...options };
	const isTopN = isTopNResponse(text);

	const candidates: Array<DetectedList & { priority: number }> = [];

	const numbered = detectNumberedList(text);
	if (
		numbered &&
		numbered.items.length >= opts.minListItems &&
		numbered.items.length <= opts.maxListItems
	) {
		candidates.push({
			...numbered,
			format: isTopN ? "top-n" : "numbered",
			priority: isTopN ? 5 : 4,
		});
	}

	const bullet = detectBulletList(text);
	if (
		bullet &&
		bullet.items.length >= opts.minListItems &&
		bullet.items.length <= opts.maxListItems
	) {
		candidates.push({ ...bullet, priority: 3 });
	}

	const headed = detectHeadedList(text);
	if (
		headed &&
		headed.items.length >= opts.minListItems &&
		headed.items.length <= opts.maxListItems
	) {
		candidates.push({ ...headed, priority: 2 });
	}

	// Sort by priority descending, return without the internal priority field
	return candidates.sort((a, b) => b.priority - a.priority).map(({ priority: _, ...list }) => list);
}
