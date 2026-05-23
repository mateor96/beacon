import { describe, expect, it } from "vitest";
import {
	CompetitorsQuerySchema,
	MentionTypeEnum,
	MentionsQuerySchema,
	ModelEnum,
	OverviewQuerySchema,
	RankingsQuerySchema,
	SentimentEnum,
	SentimentQuerySchema,
	SuggestedPromptsQuerySchema,
} from "../api.js";
import { OverviewDTOSchema } from "../responses.js";

const PROJECT_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("api schemas", () => {
	it("enums match db constants", () => {
		expect(ModelEnum.options).toContain("chatgpt");
		expect(SentimentEnum.options).toContain("neutral");
		expect(MentionTypeEnum.options).toContain("citation");
	});

	it("MentionsQuerySchema parses with defaults", () => {
		const out = MentionsQuerySchema.parse({ projectId: PROJECT_ID });
		expect(out.limit).toBe(20);
		expect(out.cursor).toBeUndefined();
	});

	it("MentionsQuerySchema accepts filters", () => {
		const out = MentionsQuerySchema.parse({
			projectId: PROJECT_ID,
			model: "chatgpt",
			sentiment: "positive",
			mentionType: "citation",
			from: "2024-01-01T00:00:00Z",
			to: "2024-12-31T00:00:00Z",
			limit: "50",
		});
		expect(out.limit).toBe(50);
		expect(out.from).toBeInstanceOf(Date);
	});

	it("rejects invalid uuid", () => {
		expect(() => MentionsQuerySchema.parse({ projectId: "nope" })).toThrow();
	});

	it("rejects from > to", () => {
		expect(() =>
			MentionsQuerySchema.parse({
				projectId: PROJECT_ID,
				from: "2024-12-01T00:00:00Z",
				to: "2024-01-01T00:00:00Z",
			}),
		).toThrow();
	});

	it("rejects limit > 100", () => {
		expect(() => MentionsQuerySchema.parse({ projectId: PROJECT_ID, limit: 9999 })).toThrow();
	});

	it("RankingsQuerySchema parses brand filter", () => {
		const out = RankingsQuerySchema.parse({ projectId: PROJECT_ID, brand: "Acme" });
		expect(out.brand).toBe("Acme");
	});

	it("SentimentQuerySchema defaults granularity to day", () => {
		const out = SentimentQuerySchema.parse({ projectId: PROJECT_ID });
		expect(out.granularity).toBe("day");
	});

	it("SentimentQuerySchema accepts week", () => {
		const out = SentimentQuerySchema.parse({ projectId: PROJECT_ID, granularity: "week" });
		expect(out.granularity).toBe("week");
	});

	it("CompetitorsQuerySchema requires projectId", () => {
		expect(() => CompetitorsQuerySchema.parse({})).toThrow();
		expect(CompetitorsQuerySchema.parse({ projectId: PROJECT_ID }).projectId).toBe(PROJECT_ID);
	});

	it("SuggestedPromptsQuerySchema applies default limit", () => {
		const out = SuggestedPromptsQuerySchema.parse({ projectId: PROJECT_ID });
		expect(out.limit).toBe(20);
	});

	it("OverviewDTOSchema parses full payload with topModel + previousPeriod", () => {
		const out = OverviewDTOSchema.parse({
			totalMentions: 10,
			mentionsBySentiment: { positive: 5, neutral: 3, negative: 2 },
			topBrands: [{ brandName: "Acme", count: 10 }],
			latestSnapshotAt: "2024-06-01T00:00:00.000Z",
			avgRankPosition: 2.4,
			topModel: { model: "chatgpt", count: 7 },
			previousPeriod: { totalMentions: 5, avgRankPosition: 3.1 },
		});
		expect(out.topModel?.model).toBe("chatgpt");
		expect(out.previousPeriod?.totalMentions).toBe(5);
	});

	it("OverviewDTOSchema accepts null topModel and previousPeriod", () => {
		const out = OverviewDTOSchema.parse({
			totalMentions: 0,
			mentionsBySentiment: { positive: 0, neutral: 0, negative: 0 },
			topBrands: [],
			latestSnapshotAt: null,
			avgRankPosition: null,
			topModel: null,
			previousPeriod: null,
		});
		expect(out.topModel).toBeNull();
		expect(out.previousPeriod).toBeNull();
	});

	it("OverviewQuerySchema parses date range", () => {
		const out = OverviewQuerySchema.parse({
			projectId: PROJECT_ID,
			from: "2024-01-01T00:00:00Z",
			to: "2024-02-01T00:00:00Z",
		});
		expect(out.from).toBeInstanceOf(Date);
	});
});
