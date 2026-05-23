import { z } from "zod";
import { MentionTypeEnum, ModelEnum, SentimentEnum } from "./api.js";

export function PaginatedSchema<T extends z.ZodTypeAny>(item: T) {
	return z.object({
		items: z.array(item),
		nextCursor: z.string().nullable(),
	});
}

export const MentionDTOSchema = z.object({
	id: z.string().uuid(),
	projectId: z.string().uuid(),
	snapshotId: z.string().uuid(),
	brandName: z.string(),
	mentionType: MentionTypeEnum,
	model: ModelEnum.nullable(),
	position: z.number().int().nullable(),
	contextText: z.string().nullable(),
	sentiment: SentimentEnum.nullable(),
	mentionedAt: z.string(),
});

export const RankingDTOSchema = z.object({
	id: z.string().uuid(),
	projectId: z.string().uuid(),
	snapshotId: z.string().uuid(),
	brandName: z.string(),
	model: ModelEnum,
	rankPosition: z.number().int(),
	competitorName: z.string().nullable(),
	queryText: z.string(),
	rankedAt: z.string(),
});

export const SentimentPointSchema = z.object({
	bucket: z.string(),
	positive: z.number().int(),
	neutral: z.number().int(),
	negative: z.number().int(),
	total: z.number().int(),
});

export const CompetitorDTOSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	domain: z.string().nullable(),
	latestBenchmark: z
		.object({
			shareOfVoice: z.number(),
			avgSentiment: z.number(),
			avgRank: z.number(),
			model: ModelEnum,
			benchmarkedAt: z.string(),
		})
		.nullable(),
});

export const SuggestedPromptDTOSchema = z.object({
	id: z.string().uuid(),
	prompt: z.string(),
	category: z.string().nullable(),
	createdAt: z.string().nullable(),
});

export const OverviewDTOSchema = z.object({
	totalMentions: z.number().int(),
	mentionsBySentiment: z.object({
		positive: z.number().int(),
		neutral: z.number().int(),
		negative: z.number().int(),
	}),
	topBrands: z.array(z.object({ brandName: z.string(), count: z.number().int() })),
	latestSnapshotAt: z.string().nullable(),
	avgRankPosition: z.number().nullable(),
	topModel: z
		.object({
			model: ModelEnum,
			count: z.number().int(),
		})
		.nullable(),
	previousPeriod: z
		.object({
			totalMentions: z.number().int(),
			avgRankPosition: z.number().nullable(),
		})
		.nullable(),
});
