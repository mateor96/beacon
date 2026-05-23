export interface BenchmarkInput {
	snapshotId: string;
	projectId: string;
	aiEngine: string;
	brandName: string;
	responseText: string;
	brandMentionCount: number;
	brandRankPosition: number | null;
	competitorKeywords: string[];
}

export interface CompetitorMetrics {
	name: string;
	mentionCount: number;
	shareOfVoice: number;
	avgSentiment: number;
	avgRank: number;
}

export interface BenchmarkReport {
	competitors: CompetitorMetrics[];
	totalMentions: number;
	durationMs: number;
}
