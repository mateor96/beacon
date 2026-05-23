import { z } from "zod";
// Mirror db schema enums. Kept in sync with packages/db/src/schema/ai-visibility.ts.
// We avoid importing from @beacon/db to keep this module free of the db client
// (which requires DATABASE_URL at import time).
const AI_ENGINES = ["chatgpt", "perplexity", "gemini", "claude"] as const;
const SENTIMENT_VALUES = ["positive", "neutral", "negative"] as const;
const MENTION_TYPES = ["recommendation", "comparison", "citation", "passing"] as const;

export const ModelEnum = z.enum(AI_ENGINES);
export const SentimentEnum = z.enum(SENTIMENT_VALUES);
export const MentionTypeEnum = z.enum(MENTION_TYPES);

const Uuid = z.string().uuid();

export const ProjectIdQuery = z.object({
	projectId: Uuid,
});

const isoDate = z
	.string()
	.optional()
	.refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), {
		message: "Ungültiges Datum",
	})
	.transform((v) => (v ? new Date(v) : undefined));

export const DateRangeQuery = z
	.object({
		from: isoDate,
		to: isoDate,
	})
	.refine((d) => !d.from || !d.to || d.from <= d.to, {
		message: "from muss vor oder gleich to liegen",
		path: ["from"],
	});

export const PaginationQuery = z.object({
	limit: z
		.union([z.string(), z.number()])
		.optional()
		.transform((v) => (v === undefined ? 20 : Number(v)))
		.pipe(z.number().int().min(1).max(100)),
	cursor: z.string().min(1).optional(),
});

const arrayOf = <T extends z.ZodTypeAny>(t: T) =>
	z.preprocess(
		(v) => (v === undefined || v === null || v === "" ? undefined : Array.isArray(v) ? v : [v]),
		z.array(t).optional(),
	);

export const MentionsQuerySchema = ProjectIdQuery.extend({
	model: arrayOf(ModelEnum),
	sentiment: arrayOf(SentimentEnum),
	mentionType: MentionTypeEnum.optional(),
	from: isoDate,
	to: isoDate,
	sort: z.enum(["date", "sentiment", "model"]).optional().default("date"),
	dir: z.enum(["asc", "desc"]).optional().default("desc"),
	limit: PaginationQuery.shape.limit,
	cursor: PaginationQuery.shape.cursor,
}).refine((d) => !d.from || !d.to || d.from <= d.to, {
	message: "from muss vor oder gleich to liegen",
	path: ["from"],
});

export const RankingsQuerySchema = ProjectIdQuery.extend({
	model: ModelEnum.optional(),
	brand: z.string().min(1).optional(),
	from: isoDate,
	to: isoDate,
	limit: PaginationQuery.shape.limit,
	cursor: PaginationQuery.shape.cursor,
}).refine((d) => !d.from || !d.to || d.from <= d.to, {
	message: "from muss vor oder gleich to liegen",
	path: ["from"],
});

export const SentimentQuerySchema = ProjectIdQuery.extend({
	from: isoDate,
	to: isoDate,
	granularity: z.enum(["day", "week"]).optional().default("day"),
}).refine((d) => !d.from || !d.to || d.from <= d.to, {
	message: "from muss vor oder gleich to liegen",
	path: ["from"],
});

export const CompetitorsQuerySchema = ProjectIdQuery;

export const SuggestedPromptsQuerySchema = ProjectIdQuery.extend({
	limit: PaginationQuery.shape.limit,
});

export const OverviewQuerySchema = ProjectIdQuery.extend({
	from: isoDate,
	to: isoDate,
}).refine((d) => !d.from || !d.to || d.from <= d.to, {
	message: "from muss vor oder gleich to liegen",
	path: ["from"],
});
