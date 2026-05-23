export {
	checkCompetitiveAccess,
	getCompetitorScanFrequencyDays,
	type CompetitiveAccessCheck,
	type CompetitiveAccessResult,
} from "./guard.js";
export {
	COMPETITOR_SCAN_JOB_PREFIX,
	competitorScanJobId,
	enqueueCompetitorScan,
	type EnqueueCompetitorScanParams,
	type EnqueueCompetitorScanResult,
} from "./scan.js";
export {
	calculateBenchmark,
	type Dimension,
	type DimensionScore,
	type ClientScoreInput,
	type CompetitorScoreInput,
	type BenchmarkPerDimension,
	type CalculateBenchmarkResult,
} from "./benchmarking.js";
export {
	calculateTrend,
	trendThreshold,
	recordScore,
	pruneOldHistory,
	type TrendDirection,
} from "./trends.js";
export {
	getCitationShareForProject,
	type CitationShareRow,
} from "./citations.js";
export { BEACON_DEFAULT_BRANDING, getBrandingForUser } from "./branding.js";
