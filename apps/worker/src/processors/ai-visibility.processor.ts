import type { AiEngine } from "@beacon/ai";
import type { AiVisibilityJobData, AiVisibilityJobResult } from "@beacon/queue";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";

type SourceAttributionRow = {
	mentionId: string;
	projectId: string;
	url: string;
	domain: string;
	isOwnDomain: boolean;
	matchedPageId: string | null;
	sourceType: "structured" | "unstructured";
};

function isLastAttempt(job: Job): boolean {
	const maxAttempts = job.opts.attempts ?? 1;
	return job.attemptsMade >= maxAttempts - 1;
}

export async function processAiVisibility(
	job: Job<AiVisibilityJobData, AiVisibilityJobResult>,
): Promise<AiVisibilityJobResult> {
	const { projectId, brandName, queryText, engines, localeId: jobLocaleId } = job.data;
	const log = createJobLogger({
		queue: "ai-visibility",
		jobId: job.id ?? "unknown",
		scanId: projectId,
	});

	log.info("Starting AI visibility query", { brandName, queryText, engines });

	// Dynamic import to avoid hard dependency on @beacon/ai at load time
	const { createConfiguredProviders } = await import("@beacon/ai");

	let providers = createConfiguredProviders();

	// Filter to requested engines if specified
	if (engines && engines.length > 0) {
		providers = providers.filter((p) => engines.includes(p.engine));
	}

	if (providers.length === 0) {
		throw new Error("CONFIG_ERROR: No AI engine API keys configured");
	}

	log.info("Providers ready", { count: providers.length, engines: providers.map((p) => p.engine) });

	// Locale-aware system prompt (#479): requested → de-DE → hardcoded.
	const HARDCODED_AI_VIS_PROMPT = `Du bist ein KI-Sichtbarkeits-Analyst. Pruefe ob die Marke "${brandName}" in deiner Wissensbasis vorkommt. Beantworte die folgende Frage und erwaehne die Marke wenn relevant.`;
	const { loadLocalePrompt } = await import("../lib/locale-prompt.js");
	const { db: promptDb } = await import("@beacon/db");
	const localePrompt = await loadLocalePrompt(promptDb, {
		requestedLocaleId: jobLocaleId ?? null,
		key: "readiness_check",
		hardcodedFallback: HARDCODED_AI_VIS_PROMPT,
		extraVariables: { brand_name: brandName, query: queryText, competitors: "" },
		logContext: { queue: "ai-visibility", jobId: job.id, scanId: projectId, projectId },
	});
	const systemPrompt = localePrompt.systemPrompt;

	// Fan out queries to all providers in parallel
	const results = await Promise.allSettled(
		providers.map((p) => p.query({ systemPrompt, userMessage: queryText })),
	);

	// Load DB and project data once before processing results
	const { db, aiVisibilityQueries, monitoringQueries } = await import("@beacon/db");
	const project = await monitoringQueries.getProjectById(db, projectId);

	// Build brand config for mention extraction
	let brandConfig = {
		canonicalName: brandName,
		primaryNames: [brandName],
		domains: [] as string[],
	};
	try {
		const { buildBrandConfig } = await import("@beacon/monitoring");
		brandConfig = buildBrandConfig(
			brandName,
			project?.brandKeywords ?? [brandName],
			project?.websiteUrl ?? "",
		);
	} catch {
		// Fallback brand config if @beacon/monitoring import fails
	}

	const snapshotIds: string[] = [];
	const failedEngines: Array<{ engine: string; error: string }> = [];
	let totalCostCents = 0;
	let mentionCount = 0;
	let extractionFailures = 0;
	let rankingCount = 0;
	let rankingFailures = 0;
	// Per-snapshot data for benchmarking
	const snapshotData = new Map<
		string,
		{
			text: string;
			engine: AiEngine;
			brandMentionCount: number;
			brandRankPosition: number | null;
			competitorRanks: Map<string, number>;
		}
	>();
	const allCreatedMentions: Array<{
		mentionId: string;
		brandName: string;
		contextText: string;
		mentionType: string;
		aiEngine: string;
		currentSentiment: "positive" | "neutral" | "negative";
	}> = [];

	for (let i = 0; i < results.length; i++) {
		const result = results[i];
		const provider = providers[i];

		if (result.status === "fulfilled") {
			const { text, model, inputTokens, outputTokens, durationMs, costCents } = result.value;

			const snapshot = await aiVisibilityQueries.createSnapshot(db, {
				projectId,
				brandName,
				aiEngine: provider.engine,
				queryText,
				rawResponse: {
					text,
					model,
					usage: { inputTokens, outputTokens },
					durationMs,
				},
				costCents: costCents ?? 0,
			});

			snapshotIds.push(snapshot.id);
			totalCostCents += costCents ?? 0;

			log.info("Snapshot created", { engine: provider.engine, snapshotId: snapshot.id, costCents });

			// Extract brand mentions from the AI response
			let mentionResults:
				| ReturnType<typeof import("@beacon/monitoring").extractMentions>["mentions"]
				| undefined;
			try {
				const { extractMentions } = await import("@beacon/monitoring");
				const report = extractMentions(text, brandConfig);
				mentionResults = report.mentions;

				for (const mention of report.mentions) {
					const record = await aiVisibilityQueries.createMention(db, {
						snapshotId: snapshot.id,
						projectId,
						brandName: mention.brandName,
						mentionType: mention.mentionType,
						position: mention.position,
						contextText: mention.contextText,
						sentiment: mention.sentiment,
					});

					// Collect for LLM sentiment enrichment
					allCreatedMentions.push({
						mentionId: record.id,
						brandName: mention.brandName,
						contextText: mention.contextText,
						mentionType: mention.mentionType,
						aiEngine: provider.engine,
						currentSentiment: mention.sentiment,
					});
				}

				mentionCount += report.mentions.length;
				if (report.mentions.length > 0) {
					log.info("Mentions extracted", {
						engine: provider.engine,
						snapshotId: snapshot.id,
						mentionCount: report.mentions.length,
					});
				}
			} catch (extractionErr) {
				extractionFailures++;
				log.warn("Mention extraction failed", {
					engine: provider.engine,
					snapshotId: snapshot.id,
					error: extractionErr instanceof Error ? extractionErr.message : String(extractionErr),
				});
			}

			// Extract ranking positions from the AI response
			let brandRankPos: number | null = null;
			const compRanks = new Map<string, number>();
			try {
				const { extractRankings } = await import("@beacon/monitoring");
				const rankingReport = extractRankings(
					text,
					brandConfig,
					project?.competitorKeywords ?? [],
					mentionResults,
				);

				for (const ranking of rankingReport.rankings) {
					await aiVisibilityQueries.createRanking(db, {
						snapshotId: snapshot.id,
						projectId,
						brandName,
						aiEngine: provider.engine,
						rankPosition: ranking.rankPosition,
						competitorName: ranking.isTargetBrand ? null : ranking.entityName,
						queryText,
					});
					if (ranking.isTargetBrand) {
						brandRankPos = ranking.rankPosition;
					} else {
						compRanks.set(ranking.entityName, ranking.rankPosition);
					}
				}

				rankingCount += rankingReport.rankings.length;
				if (rankingReport.rankings.length > 0) {
					log.info("Rankings extracted", {
						engine: provider.engine,
						snapshotId: snapshot.id,
						rankingCount: rankingReport.rankings.length,
						listDetected: rankingReport.listDetected,
					});
				}
			} catch (rankingErr) {
				rankingFailures++;
				log.warn("Ranking extraction failed", {
					engine: provider.engine,
					snapshotId: snapshot.id,
					error: rankingErr instanceof Error ? rankingErr.message : String(rankingErr),
				});
			}

			// Collect per-snapshot data for benchmarking
			snapshotData.set(snapshot.id, {
				text,
				engine: provider.engine,
				brandMentionCount: mentionResults?.length ?? 0,
				brandRankPosition: brandRankPos,
				competitorRanks: compRanks,
			});
		} else {
			const errorMsg =
				result.reason instanceof Error ? result.reason.message : String(result.reason);
			log.warn("Engine query failed", { engine: provider.engine, error: errorMsg });
			failedEngines.push({ engine: provider.engine, error: errorMsg });
		}
	}

	// If ALL engines failed, throw to trigger BullMQ retry
	if (snapshotIds.length === 0) {
		const summary = failedEngines.map((f) => `${f.engine}: ${f.error}`).join("; ");
		throw new Error(`All engines failed: ${summary}`);
	}

	// Source attribution extraction (#188) — per-snapshot URL extraction + client-page
	// matching. Attached to the first mention of the snapshot; no-op if no mentions.
	let sourceAttributions = 0;
	let unstructuredAttributions = 0;
	try {
		const { extractSources } = await import("@beacon/ai");
		const { aiVisibilityQueries: attrQueries } = await import("@beacon/db");
		const { db: attrDb } = await import("@beacon/db");
		const ownDomain = project?.websiteUrl
			? new URL(project.websiteUrl).hostname.toLowerCase()
			: null;
		const mentionsBySnapshot = new Map<string, string>();
		for (const m of allCreatedMentions) {
			if (!mentionsBySnapshot.has(m.mentionId)) {
				mentionsBySnapshot.set(m.mentionId, m.mentionId);
			}
		}
		for (const [snapId, data] of snapshotData) {
			const firstMention = allCreatedMentions.find((m) => m.aiEngine === data.engine);
			if (!firstMention) continue;
			const report = extractSources({ responseText: data.text, clientPages: [] });
			if (report.sources.length === 0 && !report.hasUnstructuredAttribution) continue;
			const rows: SourceAttributionRow[] = report.sources.map((s) => ({
				mentionId: firstMention.mentionId,
				projectId,
				url: s.url,
				domain: s.domain,
				isOwnDomain: ownDomain
					? s.domain === ownDomain || s.domain.endsWith(`.${ownDomain}`)
					: false,
				matchedPageId: s.matchedClientPageId,
				sourceType: "structured",
			}));
			if (report.hasUnstructuredAttribution) {
				rows.push({
					mentionId: firstMention.mentionId,
					projectId,
					url: "",
					domain: "",
					isOwnDomain: false,
					matchedPageId: null,
					sourceType: "unstructured",
				});
				unstructuredAttributions++;
			}
			const inserted = await attrQueries.createSourceAttributionsBatch(attrDb, rows);
			sourceAttributions += inserted;
			log.info("Source attributions written", {
				snapshotId: snapId,
				count: inserted,
				hasUnstructured: report.hasUnstructuredAttribution,
			});
		}
	} catch (attrErr) {
		log.warn("Source attribution extraction failed", {
			error: attrErr instanceof Error ? attrErr.message : String(attrErr),
		});
	}

	// LLM sentiment enrichment (post-extraction)
	let sentimentEnriched = 0;
	let sentimentFallback = 0;
	let sentimentCostCents = 0;

	if (allCreatedMentions.length > 0) {
		try {
			const { classifySentimentBatch, ClaudeClient } = await import("@beacon/ai");

			let sentimentClient: InstanceType<typeof ClaudeClient> | null = null;
			try {
				sentimentClient = ClaudeClient.fromEnv();
			} catch {
				log.info("Claude API not configured, using keyword-based sentiment");
			}

			const batchResult = await classifySentimentBatch(allCreatedMentions, sentimentClient);

			// Update mentions with LLM sentiment (respects sentiment_override)
			const llmResults = batchResult.classifications.filter((c) => c.source === "llm");
			if (llmResults.length > 0) {
				await aiVisibilityQueries.batchUpdateMentionSentiments(
					db,
					llmResults.map((c) => ({
						mentionId: c.mentionId,
						sentiment: c.sentiment,
						sentimentConfidence: c.confidence,
					})),
				);
			}

			sentimentEnriched = batchResult.classifications.filter((c) => c.source === "llm").length;
			sentimentFallback = batchResult.classifications.filter((c) => c.source === "keyword").length;
			sentimentCostCents = batchResult.costCents;
			totalCostCents += sentimentCostCents;

			if (sentimentEnriched > 0) {
				log.info("Sentiment enrichment completed", {
					sentimentEnriched,
					sentimentFallback,
					sentimentCostCents,
				});
			}
		} catch (sentimentErr) {
			sentimentFallback = allCreatedMentions.length;
			log.warn("Sentiment enrichment failed", {
				error: sentimentErr instanceof Error ? sentimentErr.message : String(sentimentErr),
			});
		}
	}

	// Competitor benchmarking (post-processing after all snapshots)
	let benchmarkCount = 0;
	let benchmarkFailures = 0;

	const competitorKeywords = project?.competitorKeywords ?? [];
	if (competitorKeywords.length > 0 && snapshotData.size > 0) {
		try {
			const { computeBenchmarks } = await import("@beacon/monitoring");

			for (const [snapId, data] of snapshotData) {
				const benchmarkReport = computeBenchmarks(
					{
						snapshotId: snapId,
						projectId,
						aiEngine: data.engine,
						brandName,
						responseText: data.text,
						brandMentionCount: data.brandMentionCount,
						brandRankPosition: data.brandRankPosition,
						competitorKeywords,
					},
					data.competitorRanks,
				);

				for (const comp of benchmarkReport.competitors) {
					await aiVisibilityQueries.createBenchmark(db, {
						snapshotId: snapId,
						projectId,
						competitorName: comp.name,
						aiEngine: data.engine,
						shareOfVoice: comp.shareOfVoice,
						avgSentiment: comp.avgSentiment,
						avgRank: comp.avgRank,
					});
					benchmarkCount++;
				}
			}

			if (benchmarkCount > 0) {
				log.info("Benchmarks computed", { benchmarkCount });
			}
		} catch (benchErr) {
			benchmarkFailures++;
			log.warn("Benchmark computation failed", {
				error: benchErr instanceof Error ? benchErr.message : String(benchErr),
			});
		}
	}

	log.info("AI visibility query completed", {
		succeeded: snapshotIds.length,
		failed: failedEngines.length,
		totalCostCents,
		localeId: localePrompt.resolvedLocaleId,
		languageCode: localePrompt.languageCode,
		usedFallback: localePrompt.usedFallback,
		usedHardcodedDefault: localePrompt.usedHardcodedDefault,
	});

	// Alert evaluation: check alert rules after monitoring cycle (#286)
	try {
		const { processAlertsForProject } = await import("@beacon/monitoring");
		const { profileQueries: alertPq } = await import("@beacon/db");
		const billingProject = await monitoringQueries.getProjectById(db, projectId);
		if (billingProject) {
			const alertProfile = await alertPq.getById(db, billingProject.userId);
			if (alertProfile?.email) {
				const alertResult = await processAlertsForProject(db, {
					projectId,
					brandName,
					projectName: billingProject.name ?? billingProject.websiteUrl ?? brandName,
					userId: billingProject.userId,
					userEmail: alertProfile.email,
					currentMentionCount: mentionCount ?? 0,
					previousMentionCount: 0,
					currentAvgRank: null,
					previousAvgRank: null,
					newCitationCount: mentionCount ?? 0,
				});
				if (alertResult.fired > 0) {
					log.info("Alerts fired", {
						fired: alertResult.fired,
						cooledDown: alertResult.cooledDown,
					});
				}
			}
		}
	} catch (alertErr) {
		log.warn("Alert evaluation failed", {
			error: alertErr instanceof Error ? alertErr.message : String(alertErr),
		});
	}

	return {
		projectId,
		totalEngines: providers.length,
		succeeded: snapshotIds.length,
		failed: failedEngines.length,
		snapshotIds,
		failedEngines,
		totalCostCents,
		mentionCount,
		extractionFailures,
		sentimentEnriched,
		sentimentFallback,
		sentimentCostCents,
		rankingCount,
		rankingFailures,
		benchmarkCount,
		benchmarkFailures,
	};
}
