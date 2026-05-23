import { citationQueries, db } from "@beacon/db";
import { extractCitations } from "@beacon/monitoring";
import type { CitationExtractionJobData, CitationExtractionJobResult } from "@beacon/queue";
import { matchCitationToClientPage } from "@beacon/scanner";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";

export async function processCitationExtraction(
	job: Job<CitationExtractionJobData, CitationExtractionJobResult>,
): Promise<CitationExtractionJobResult> {
	const { auditId, modelName, queryText, rawResponse, crawlId } = job.data;
	const log = createJobLogger({
		queue: "citation-extraction",
		jobId: job.id ?? "unknown",
		scanId: auditId,
	});

	log.info("Starting citation extraction", { modelName, queryLength: queryText.length });

	// Idempotency check: if we already processed this (audit, model, query) tuple
	// and wrote mappings, skip re-extraction.
	const existing = await citationQueries.findCitation(db, { auditId, modelName, queryText });
	if (existing) {
		const mappingCount = await citationQueries.countMappingsForCitation(db, existing.id);
		if (mappingCount > 0) {
			log.info("Citation already processed, skipping", {
				citationId: existing.id,
				mappingCount,
			});
			return {
				citationId: existing.id,
				citationsExtracted: 0,
				citedPagesUpserted: 0,
				mappingsCreated: 0,
				skippedAsIdempotent: true,
			};
		}
	}

	const extracted = extractCitations(rawResponse);
	log.info("URLs extracted from response", { count: extracted.length });

	const citation =
		existing ??
		(await citationQueries.createCitation(db, {
			auditId,
			modelName,
			queryText,
			rawResponse,
		}));

	if (extracted.length === 0) {
		return {
			citationId: citation.id,
			citationsExtracted: 0,
			citedPagesUpserted: 0,
			mappingsCreated: 0,
			skippedAsIdempotent: false,
		};
	}

	// Load match candidates + manual aliases so extraction + page matching can
	// happen in one pass (avoids a separate matcher pass per #175).
	const [candidates, manualAliases] = await Promise.all([
		crawlId ? citationQueries.listClientPagesForCrawl(db, crawlId) : Promise.resolve([]),
		citationQueries.loadManualAliases(
			db,
			extracted.map((e) => e.normalizedUrl),
		),
	]);

	const matchByUrl = new Map<
		string,
		{ clientPageId: string | null; matchType: string; confidence: number }
	>();
	for (const e of extracted) {
		if (matchByUrl.has(e.normalizedUrl)) continue;
		const match = matchCitationToClientPage({
			citationUrl: e.normalizedUrl,
			candidates,
			manualAliases,
		});
		matchByUrl.set(e.normalizedUrl, match);
	}

	const citedPageIdByUrl = new Map<string, string>();
	let upsertFailures = 0;
	for (const c of extracted) {
		if (citedPageIdByUrl.has(c.normalizedUrl)) continue;
		const match = matchByUrl.get(c.normalizedUrl);
		try {
			const citedPageId = await citationQueries.upsertCitedPage(db, {
				url: c.normalizedUrl,
				canonicalUrl: c.normalizedUrl,
				domain: c.domain,
				clientPageId: match?.clientPageId ?? null,
			});
			citedPageIdByUrl.set(c.normalizedUrl, citedPageId);
		} catch (err) {
			upsertFailures++;
			log.warn("Cited page upsert failed", {
				url: c.normalizedUrl,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	const mappings = extracted
		.map((c) => {
			const citedPageId = citedPageIdByUrl.get(c.normalizedUrl);
			if (!citedPageId) return null;
			const match = matchByUrl.get(c.normalizedUrl);
			return {
				citedPageId,
				position: c.position,
				contextSnippet: c.contextSnippet,
				matchType: (match?.matchType ?? "unmatched") as
					| "exact"
					| "path"
					| "fuzzy"
					| "manual"
					| "unmatched",
				matchConfidence: match?.confidence ?? 0,
			};
		})
		.filter((m): m is NonNullable<typeof m> => m !== null);

	const mappingsCreated = await citationQueries.createMappings(db, citation.id, mappings);

	const matchBreakdown = { exact: 0, path: 0, fuzzy: 0, manual: 0, unmatched: 0 };
	for (const m of matchByUrl.values()) {
		matchBreakdown[m.matchType as keyof typeof matchBreakdown]++;
	}

	// #179: write a citation_snapshots row per distinct matched client page so
	// before/after impact comparisons have data to work from. Snapshot type is
	// "before" if no prior snapshot exists for this client page, otherwise
	// "after". One row per client page per audit.
	const matchedClientPageIds = new Set<string>();
	for (const match of matchByUrl.values()) {
		if (match.clientPageId) matchedClientPageIds.add(match.clientPageId);
	}
	let snapshotsWritten = 0;
	for (const clientPageId of matchedClientPageIds) {
		try {
			const [agg, existingBefore] = await Promise.all([
				citationQueries.aggregateCitationsForScanPage(db, auditId, clientPageId),
				citationQueries.findLatestSnapshot(db, clientPageId, "before"),
			]);
			const snapshotType = existingBefore ? "after" : "before";
			await citationQueries.writeCitationSnapshot(db, {
				auditId,
				clientPageId,
				snapshotType,
				totalCitations: agg.totalCitations,
				modelBreakdown: agg.modelBreakdown,
			});
			snapshotsWritten++;
		} catch (snapErr) {
			log.warn("Snapshot write failed", {
				clientPageId,
				error: snapErr instanceof Error ? snapErr.message : String(snapErr),
			});
		}
	}

	log.info("Citation extraction completed", {
		citationId: citation.id,
		citationsExtracted: extracted.length,
		citedPagesUpserted: citedPageIdByUrl.size,
		mappingsCreated,
		upsertFailures,
		matchBreakdown,
		snapshotsWritten,
	});

	return {
		citationId: citation.id,
		citationsExtracted: extracted.length,
		citedPagesUpserted: citedPageIdByUrl.size,
		mappingsCreated,
		skippedAsIdempotent: false,
	};
}
