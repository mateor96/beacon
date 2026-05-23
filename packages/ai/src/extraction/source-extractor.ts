import { type ExtractedCitation, extractCitations } from "@beacon/monitoring";
import { type MatchCandidate, type MatchKind, matchCitationToClientPage } from "@beacon/scanner";

const UNSTRUCTURED_MARKERS = [
	"laut experten",
	"laut studien",
	"according to experts",
	"according to studies",
	"experts say",
	"studies show",
	"research shows",
	"research indicates",
] as const;

export type SourceAttributionKind = "structured" | "unstructured";

export interface ExtractedSource {
	url: string;
	domain: string;
	rawUrl: string;
	sourceType: SourceAttributionKind;
	position: number;
	contextSnippet: string;
	matchedClientPageId: string | null;
	matchKind: MatchKind;
}

export interface SourceExtractionInput {
	responseText: string;
	/** Additional structured citations from provider metadata (e.g. Perplexity sources) that don't appear inline in the text. */
	providerCitations?: Array<{ url: string; title?: string }>;
	/** Candidate client pages for matching. */
	clientPages?: MatchCandidate[];
	/** Domains that belong to the customer (for isOwnDomain flag — caller decides). */
}

export interface SourceExtractionReport {
	sources: ExtractedSource[];
	/** True if the response contains attribution-sounding prose without URLs — caller may emit an unstructured_source marker row. */
	hasUnstructuredAttribution: boolean;
}

function detectUnstructured(text: string): boolean {
	const lower = text.toLowerCase();
	return UNSTRUCTURED_MARKERS.some((marker) => lower.includes(marker));
}

function mergeProviderCitations(
	text: string,
	existing: ExtractedCitation[],
	providerCitations: Array<{ url: string; title?: string }>,
): ExtractedCitation[] {
	if (providerCitations.length === 0) return existing;
	const seen = new Set(existing.map((c) => c.normalizedUrl));
	const extra: ExtractedCitation[] = [];
	for (const cit of providerCitations) {
		let parsed: URL;
		try {
			parsed = new URL(cit.url);
		} catch {
			continue;
		}
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
		const normalized = parsed.toString().replace(/#.*$/, "");
		if (seen.has(normalized)) continue;
		seen.add(normalized);
		extra.push({
			rawUrl: cit.url,
			normalizedUrl: normalized,
			domain: parsed.hostname.toLowerCase(),
			position: text.length + extra.length,
			contextSnippet: cit.title ?? "",
		});
	}
	return existing.concat(extra);
}

/**
 * Extract source attributions from an AI response. Combines in-text URL
 * extraction (markdown / inline / angle-bracketed / numbered footnote) with
 * structured provider-side citations (e.g. Perplexity). Each source is matched
 * against known client pages via the 3-stage matcher from #175. If the text
 * contains attribution-sounding prose without URLs, hasUnstructuredAttribution
 * is true so the caller can emit an unstructured marker row.
 */
export function extractSources(input: SourceExtractionInput): SourceExtractionReport {
	const { responseText, providerCitations = [], clientPages = [] } = input;

	const inline = extractCitations(responseText);
	const merged = mergeProviderCitations(responseText, inline, providerCitations);

	const sources: ExtractedSource[] = merged.map((c) => {
		const match = matchCitationToClientPage({
			citationUrl: c.normalizedUrl,
			candidates: clientPages,
		});
		return {
			url: c.normalizedUrl,
			domain: c.domain,
			rawUrl: c.rawUrl,
			sourceType: "structured",
			position: c.position,
			contextSnippet: c.contextSnippet,
			matchedClientPageId: match.clientPageId,
			matchKind: match.matchType,
		};
	});

	const hasUnstructuredAttribution = sources.length === 0 && detectUnstructured(responseText);

	return { sources, hasUnstructuredAttribution };
}
