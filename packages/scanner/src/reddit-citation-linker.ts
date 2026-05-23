/**
 * Reddit-to-AI-Citation linker (#186).
 *
 * Pure helpers (URL parsing + matching); DB persistence lives in the
 * caller (worker / API route) via `@beacon/db` redditQueries. That split
 * keeps this module free of DB imports for testability.
 */

export interface ParsedRedditUrl {
	subreddit: string | null;
	postId: string | null;
	commentId: string | null;
}

const REDDIT_URL_RE =
	/^(?:https?:\/\/)?(?:www\.|old\.|new\.|m\.)?reddit\.com\/r\/([^/]+)\/comments\/([^/]+)(?:\/[^/]*(?:\/([^/?#]+))?)?/i;

/**
 * Normalise a Reddit URL into its canonical parts. Returns nulls for
 * all fields if the URL isn't a Reddit link. Handles www/old/new/m
 * subdomains and both full-thread and permalink-to-comment forms.
 */
export function parseRedditUrl(url: string): ParsedRedditUrl {
	if (!url) return { subreddit: null, postId: null, commentId: null };
	const match = REDDIT_URL_RE.exec(url.trim());
	if (!match) return { subreddit: null, postId: null, commentId: null };
	const [, subreddit, postId, commentId] = match;
	return {
		subreddit: subreddit?.toLowerCase() ?? null,
		postId: postId ?? null,
		commentId: commentId && commentId.length > 0 ? commentId : null,
	};
}

export function isRedditUrl(url: string): boolean {
	const parsed = parseRedditUrl(url);
	return parsed.postId !== null;
}

export interface CitationLinkCandidate {
	citationId: string;
	mentionType: "post" | "comment";
	mentionRedditId: string;
	confidenceScore: number; // 1.0 exact, 0.7 partial (post id + different comment)
}

export interface CitationInput {
	id: string;
	/** Full raw AI response text — we scan it for Reddit URLs. */
	rawResponse: string;
}

const URL_SCAN_RE = /\bhttps?:\/\/(?:www\.|old\.|new\.|m\.)?reddit\.com\/[^\s)\]]+/gi;

/**
 * Extracts all Reddit URLs found in an AI response body. Deduplicated.
 */
export function extractRedditUrls(text: string): string[] {
	const matches = text.match(URL_SCAN_RE);
	if (!matches) return [];
	return Array.from(new Set(matches));
}

/**
 * Build link candidates by matching extracted Reddit URLs against known
 * post/comment reddit_ids. Caller passes the known IDs (fetched from the
 * DB via redditQueries.listKnown*Ids) — this helper is pure.
 *
 *  - Comment permalink + comment id known → mentionType="comment", confidence 1.0
 *  - Post URL + post id known → mentionType="post", confidence 1.0
 *  - Comment permalink but only parent post known → mentionType="post",
 *    confidence 0.7 (partial: we know the thread but not the specific comment)
 */
export function matchCitationsToMentions(
	citations: CitationInput[],
	knownPostIds: Set<string>,
	knownCommentIds: Set<string>,
): CitationLinkCandidate[] {
	const out: CitationLinkCandidate[] = [];
	const seen = new Set<string>(); // dedupe by citation+mentionType+mentionId
	for (const citation of citations) {
		const urls = extractRedditUrls(citation.rawResponse);
		for (const url of urls) {
			const parsed = parseRedditUrl(url);
			if (!parsed.postId) continue;

			if (parsed.commentId && knownCommentIds.has(parsed.commentId)) {
				const key = `${citation.id}:comment:${parsed.commentId}`;
				if (!seen.has(key)) {
					seen.add(key);
					out.push({
						citationId: citation.id,
						mentionType: "comment",
						mentionRedditId: parsed.commentId,
						confidenceScore: 1.0,
					});
				}
				continue;
			}
			if (knownPostIds.has(parsed.postId)) {
				const partial = parsed.commentId !== null; // comment cited but we only know the post
				const key = `${citation.id}:post:${parsed.postId}`;
				if (!seen.has(key)) {
					seen.add(key);
					out.push({
						citationId: citation.id,
						mentionType: "post",
						mentionRedditId: parsed.postId,
						confidenceScore: partial ? 0.7 : 1.0,
					});
				}
			}
		}
	}
	return out;
}
