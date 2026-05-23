export interface CitationSnapshotData {
	totalCitations: number;
	modelBreakdown: Record<string, number>;
	urls: string[];
}

export interface CitationDelta {
	totalChange: number;
	percentChange: number;
	byModel: Record<string, { before: number; after: number; change: number }>;
	newCitations: string[];
	lostCitations: string[];
}

/**
 * Pure delta computation between two citation snapshots. Produces absolute and
 * percentage changes in total citations, per-model before/after/change counts,
 * and the list of URLs that appeared only in the after snapshot (new) or only
 * in the before snapshot (lost).
 *
 * Percent change uses the before-total as the denominator. When before is 0,
 * percentChange is 100 if after > 0 and 0 otherwise (infinity would be
 * surprising in dashboards).
 */
export function computeCitationDelta(
	before: CitationSnapshotData,
	after: CitationSnapshotData,
): CitationDelta {
	const totalChange = after.totalCitations - before.totalCitations;
	const percentChange =
		before.totalCitations === 0
			? after.totalCitations > 0
				? 100
				: 0
			: Math.round((totalChange / before.totalCitations) * 100);

	const modelKeys = new Set([
		...Object.keys(before.modelBreakdown),
		...Object.keys(after.modelBreakdown),
	]);
	const byModel: CitationDelta["byModel"] = {};
	for (const key of modelKeys) {
		const b = before.modelBreakdown[key] ?? 0;
		const a = after.modelBreakdown[key] ?? 0;
		byModel[key] = { before: b, after: a, change: a - b };
	}

	const beforeUrlSet = new Set(before.urls);
	const afterUrlSet = new Set(after.urls);
	const newCitations = after.urls.filter((u) => !beforeUrlSet.has(u));
	const lostCitations = before.urls.filter((u) => !afterUrlSet.has(u));

	return { totalChange, percentChange, byModel, newCitations, lostCitations };
}
