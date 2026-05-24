import { db, redditQueries } from "@beacon/db";
import { UuidSchema } from "@beacon/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string }>;
}

type Sentiment = "positive" | "neutral" | "negative";
const SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative"];

/**
 * Paginated Reddit mentions for a project (brandId == project.id). Filters:
 * subreddit, sentiment, aiCitedOnly, limit, offset.
 */
export async function GET(request: Request, { params }: RouteContext) {
	const { id } = await params;
	if (!UuidSchema.safeParse(id).success) {
		return NextResponse.json({ error: "Ungültige Projekt-ID." }, { status: 400 });
	}

	const url = new URL(request.url);
	const sentimentParam = url.searchParams.get("sentiment");
	const sentiment = SENTIMENTS.includes(sentimentParam as Sentiment)
		? (sentimentParam as Sentiment)
		: undefined;
	const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);
	const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

	const mentions = await redditQueries.listMentionsForBrand(db, {
		brandId: id,
		subreddit: url.searchParams.get("subreddit") ?? undefined,
		sentiment,
		aiCitedOnly: url.searchParams.get("aiCitedOnly") === "true",
		limit,
		offset,
	});

	return NextResponse.json({ mentions });
}
