export type Dimension =
	| "readinessScore"
	| "jsonLdScore"
	| "llmsTxtScore"
	| "agentsMdScore"
	| "citationCount";

export interface DimensionScore {
	readinessScore?: number | null;
	jsonLdScore?: number | null;
	llmsTxtScore?: number | null;
	agentsMdScore?: number | null;
	citationCount?: number | null;
}

export interface ClientScoreInput extends DimensionScore {
	id?: string;
}

export interface CompetitorScoreInput extends DimensionScore {
	id: string;
	name?: string | null;
	domain?: string | null;
}

export interface BenchmarkPerDimension {
	clientValue: number | null;
	rank: number | null;
	/** 0-100: % of competitors the client beats (strictly less than). */
	percentile: number | null;
	avgCompetitor: number | null;
	bestCompetitor: number | null;
	worstCompetitor: number | null;
	/** Absolute difference (client - bestCompetitor). Positive = client leads. */
	gapVsBest: number | null;
}

export interface CalculateBenchmarkResult {
	byDimension: Record<Dimension, BenchmarkPerDimension>;
	competitorCount: number;
}

const DIMENSIONS: readonly Dimension[] = [
	"readinessScore",
	"jsonLdScore",
	"llmsTxtScore",
	"agentsMdScore",
	"citationCount",
] as const;

function extractNumbers(rows: DimensionScore[], dim: Dimension): number[] {
	return rows
		.map((r) => r[dim])
		.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

/**
 * Relative benchmarking: for each dimension, compare the client's score
 * against every competitor's score and return rank (1 = best), percentile
 * (share strictly beaten), average/best/worst, and gap vs best.
 *
 * Edge cases:
 *  - No competitors → every percentile / rank null, just averages null
 *  - Client missing a dimension → clientValue null, rank null
 *  - Competitors missing dimension → they're excluded from that dimension's
 *    stats (not treated as zero)
 */
export function calculateBenchmark(
	client: ClientScoreInput,
	competitors: CompetitorScoreInput[],
): CalculateBenchmarkResult {
	const byDimension = {} as Record<Dimension, BenchmarkPerDimension>;
	for (const dim of DIMENSIONS) {
		const compValues = extractNumbers(competitors, dim);
		const clientValue = typeof client[dim] === "number" ? (client[dim] as number) : null;

		if (compValues.length === 0) {
			byDimension[dim] = {
				clientValue,
				rank: null,
				percentile: null,
				avgCompetitor: null,
				bestCompetitor: null,
				worstCompetitor: null,
				gapVsBest: null,
			};
			continue;
		}

		const avg = compValues.reduce((a, b) => a + b, 0) / compValues.length;
		const best = Math.max(...compValues);
		const worst = Math.min(...compValues);

		let rank: number | null = null;
		let percentile: number | null = null;
		if (clientValue !== null) {
			const combined = [...compValues, clientValue].sort((a, b) => b - a);
			rank = combined.indexOf(clientValue) + 1;
			const beaten = compValues.filter((v) => v < clientValue).length;
			percentile = Math.round((beaten / compValues.length) * 100);
		}

		byDimension[dim] = {
			clientValue,
			rank,
			percentile,
			avgCompetitor: Math.round(avg * 100) / 100,
			bestCompetitor: best,
			worstCompetitor: worst,
			gapVsBest: clientValue !== null ? clientValue - best : null,
		};
	}
	return { byDimension, competitorCount: competitors.length };
}
