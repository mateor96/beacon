import type { CheckContext, PrefetchedResource } from "@beacon/shared";
import { parse } from "node-html-parser";
import type { FetchResult } from "./fetcher.js";

export function buildCheckContext(
	url: string,
	fetchResult: FetchResult,
	subResources: Record<string, PrefetchedResource | null> = {},
): CheckContext {
	const parsedHtml = parse(fetchResult.html);

	return {
		inputUrl: url,
		finalUrl: fetchResult.finalUrl,
		html: fetchResult.html,
		parsedHtml,
		responseTime: fetchResult.responseTime,
		statusCode: fetchResult.statusCode,
		redirects: fetchResult.redirects,
		subResources,
	};
}
