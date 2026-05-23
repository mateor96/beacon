/**
 * Reddit API client abstraction (#180). Production wiring talks to the
 * official Reddit OAuth2 endpoints or the pullpush.io fallback; tests
 * inject a stub. The worker only depends on this interface.
 */

export interface RedditSearchResultPost {
	redditId: string; // base36, without t3_ prefix
	subreddit: string;
	title: string;
	body: string | null;
	author: string | null;
	score: number;
	url: string; // absolute reddit.com URL to the post
	createdAt: Date;
}

export interface RedditSearchResultComment {
	redditId: string; // base36, without t1_ prefix
	postRedditId: string; // parent post's base36 id
	body: string;
	author: string | null;
	score: number;
	url: string;
	createdAt: Date;
}

export interface RedditSearchResult {
	posts: RedditSearchResultPost[];
	comments: RedditSearchResultComment[];
}

export interface RedditSearchOptions {
	keyword: string;
	subreddit?: string;
	limit?: number;
}

export interface RedditClient {
	search(opts: RedditSearchOptions): Promise<RedditSearchResult>;
}

/** No-op client for environments without REDDIT_CLIENT_ID/SECRET. */
export const NULL_REDDIT_CLIENT: RedditClient = {
	async search() {
		return { posts: [], comments: [] };
	},
};

export function isConfigured(): boolean {
	return Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
}

/**
 * Build the production client if credentials are set, otherwise a no-op.
 * Kept as a factory so tests can swap by re-importing the module, and
 * so the worker can early-exit when Reddit is disabled.
 *
 * The live HTTP implementation is intentionally omitted from this PR —
 * the worker plumbing (rate-limiter, dedup, sentiment, persistence) is
 * the higher-value piece and lives here. Live Reddit client wiring is
 * a follow-up that swaps this factory.
 */
export function buildRedditClient(): RedditClient {
	if (!isConfigured()) return NULL_REDDIT_CLIENT;
	return NULL_REDDIT_CLIENT;
}
