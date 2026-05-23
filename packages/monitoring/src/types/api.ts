import type { z } from "zod";
import type {
	CompetitorsQuerySchema,
	MentionsQuerySchema,
	OverviewQuerySchema,
	RankingsQuerySchema,
	SentimentQuerySchema,
	SuggestedPromptsQuerySchema,
} from "../schemas/api.js";
import type {
	CompetitorDTOSchema,
	MentionDTOSchema,
	OverviewDTOSchema,
	RankingDTOSchema,
	SentimentPointSchema,
	SuggestedPromptDTOSchema,
} from "../schemas/responses.js";

export type MentionsQuery = z.infer<typeof MentionsQuerySchema>;
export type RankingsQuery = z.infer<typeof RankingsQuerySchema>;
export type SentimentQuery = z.infer<typeof SentimentQuerySchema>;
export type CompetitorsQuery = z.infer<typeof CompetitorsQuerySchema>;
export type SuggestedPromptsQuery = z.infer<typeof SuggestedPromptsQuerySchema>;
export type OverviewQuery = z.infer<typeof OverviewQuerySchema>;

export type MentionDTO = z.infer<typeof MentionDTOSchema>;
export type RankingDTO = z.infer<typeof RankingDTOSchema>;
export type SentimentPoint = z.infer<typeof SentimentPointSchema>;
export type CompetitorDTO = z.infer<typeof CompetitorDTOSchema>;
export type SuggestedPromptDTO = z.infer<typeof SuggestedPromptDTOSchema>;
export type OverviewDTO = z.infer<typeof OverviewDTOSchema>;

export type Paginated<T> = { items: T[]; nextCursor: string | null };
