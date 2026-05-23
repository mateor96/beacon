import type { DbClient } from "@beacon/db";
import { competitiveQueries, competitorQueries } from "@beacon/db";

export interface CitationShareRow {
	domain: string;
	domainKey: string;
	competitorId: string | null;
	citationCount: number;
	sharePercent: number;
	isClient: boolean;
}

/**
 * Build the share-of-AI-voice table for a monitoring project:
 * client citations (attributed via domainKey `project:{projectId}`) plus
 * one row per competitor from their most recent scan result.
 *
 * Share = citations / (clientCitations + sum(competitorCitations)) * 100.
 */
export async function getCitationShareForProject(
	db: DbClient,
	params: { projectId: string; clientCitationCount: number; clientDomain: string },
): Promise<CitationShareRow[]> {
	const competitors = await competitorQueries.getByProjectId(db, params.projectId);
	const competitorScans = await competitiveQueries.listCompletedScansForCompetitors(
		db,
		competitors.map((c) => c.id),
	);
	// Latest scan per competitor (listCompletedScansForCompetitors returns newest first).
	const latestByCompetitor = new Map<string, number>();
	for (const s of competitorScans) {
		if (!latestByCompetitor.has(s.competitorId)) {
			latestByCompetitor.set(s.competitorId, s.citationCount);
		}
	}

	const clientRow: CitationShareRow = {
		domain: params.clientDomain,
		domainKey: `project:${params.projectId}`,
		competitorId: null,
		citationCount: params.clientCitationCount,
		sharePercent: 0,
		isClient: true,
	};
	const competitorRows: CitationShareRow[] = competitors.map((c) => ({
		domain: c.domain ?? c.name,
		domainKey: `competitor:${c.id}`,
		competitorId: c.id,
		citationCount: latestByCompetitor.get(c.id) ?? 0,
		sharePercent: 0,
		isClient: false,
	}));

	const total = clientRow.citationCount + competitorRows.reduce((s, r) => s + r.citationCount, 0);
	const withShare = [clientRow, ...competitorRows].map((r) => ({
		...r,
		sharePercent: total > 0 ? Math.round((r.citationCount / total) * 10000) / 100 : 0,
	}));
	return withShare;
}
