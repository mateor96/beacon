import { type RedditSentiment, db, redditQueries } from "@beacon/db";
import type { RedditClient } from "./client.js";
import { type RateLimiter, createTokenBucket } from "./rate-limiter.js";

export interface DiscoveryRunResult {
	brandsProcessed: number;
	keywordsSearched: number;
	newPosts: number;
	newComments: number;
	skippedBilling: number;
	errors: number;
}

export interface BrandForDiscovery {
	brandId: string;
	keywords: string[];
	/** Precomputed: is this brand's plan allowed to run Reddit discovery? */
	redditEnabled: boolean;
}

export interface SentimentClassifier {
	classify(text: string): Promise<{ sentiment: RedditSentiment; score: number | null }>;
}

/** Default classifier that skips sentiment entirely (leaves NULL). */
export const NULL_SENTIMENT_CLASSIFIER: SentimentClassifier = {
	async classify() {
		return { sentiment: "neutral", score: null };
	},
};

export interface RunDiscoveryDeps {
	client: RedditClient;
	brands: BrandForDiscovery[];
	rateLimiter?: RateLimiter;
	sentiment?: SentimentClassifier;
	logger?: {
		info: (msg: string, meta?: Record<string, unknown>) => void;
		warn: (msg: string, meta?: Record<string, unknown>) => void;
		error: (msg: string, err?: unknown) => void;
	};
}

/**
 * Runs a single pass of Reddit discovery across the provided brands.
 * Idempotent via reddit_id unique constraint — re-running is safe.
 *
 * Error strategy: per-keyword try/catch so one failing query doesn't
 * block the rest of the brands in the same run. The count is returned
 * so the cron handler can surface it in logs.
 */
export async function runRedditDiscovery(deps: RunDiscoveryDeps): Promise<DiscoveryRunResult> {
	const rate = deps.rateLimiter ?? createTokenBucket({ capacity: 60, refillPerSecond: 1 });
	const sentiment = deps.sentiment ?? NULL_SENTIMENT_CLASSIFIER;
	const log = deps.logger ?? { info: () => {}, warn: () => {}, error: () => {} };

	const result: DiscoveryRunResult = {
		brandsProcessed: 0,
		keywordsSearched: 0,
		newPosts: 0,
		newComments: 0,
		skippedBilling: 0,
		errors: 0,
	};

	for (const brand of deps.brands) {
		if (!brand.redditEnabled) {
			result.skippedBilling += 1;
			log.info("Skipping brand — reddit tracking disabled", { brandId: brand.brandId });
			continue;
		}
		result.brandsProcessed += 1;

		for (const keyword of brand.keywords) {
			if (!keyword || keyword.trim().length === 0) continue;
			result.keywordsSearched += 1;

			try {
				await rate.take();
				const search = await deps.client.search({ keyword });

				for (const p of search.posts) {
					const inserted = await redditQueries.upsertPost(db, {
						redditId: p.redditId,
						subreddit: p.subreddit,
						title: p.title,
						body: p.body,
						author: p.author,
						score: p.score,
						url: p.url,
						createdAt: p.createdAt,
					});
					if (inserted) {
						result.newPosts += 1;
						const textForSentiment = `${p.title}\n\n${p.body ?? ""}`.slice(0, 2000);
						let s: Awaited<ReturnType<SentimentClassifier["classify"]>>;
						try {
							s = await sentiment.classify(textForSentiment);
						} catch {
							s = { sentiment: "neutral", score: null };
						}
						await redditQueries.linkMentionToBrand(db, {
							mentionType: "post",
							mentionId: inserted.id,
							brandId: brand.brandId,
							keywordMatched: keyword,
							sentiment: s.sentiment,
							sentimentScore: s.score,
						});
					}
				}

				for (const c of search.comments) {
					// Comments require a known parent post. Skip when missing —
					// the discovery pass that ingested the post will also find
					// the comments in the next run.
					const parent = await redditQueries.getPostByRedditId(db, c.postRedditId);
					if (!parent) continue;
					const inserted = await redditQueries.upsertComment(db, {
						redditId: c.redditId,
						postId: parent.id,
						body: c.body,
						author: c.author,
						score: c.score,
						url: c.url,
						createdAt: c.createdAt,
					});
					if (inserted) {
						result.newComments += 1;
						let s: Awaited<ReturnType<SentimentClassifier["classify"]>>;
						try {
							s = await sentiment.classify(c.body.slice(0, 2000));
						} catch {
							s = { sentiment: "neutral", score: null };
						}
						await redditQueries.linkMentionToBrand(db, {
							mentionType: "comment",
							mentionId: inserted.id,
							brandId: brand.brandId,
							keywordMatched: keyword,
							sentiment: s.sentiment,
							sentimentScore: s.score,
						});
					}
				}
			} catch (err) {
				result.errors += 1;
				log.error(`Reddit search failed for keyword "${keyword}"`, err);
			}
		}
	}

	return result;
}
