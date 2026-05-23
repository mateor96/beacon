import type { TemplateVariables } from "@beacon/ai";
import type { DbClient } from "@beacon/db";
import { createJobLogger } from "./logger.js";

/**
 * Three-layer locale prompt loader (#479).
 *
 *   1. requested locale   → prompt_templates(locale_id, key)
 *   2. de-DE fallback     → prompt_templates(de-DE UUID, key)   (#199)
 *   3. hardcoded default  → caller-provided string
 *
 * Never throws on "template not found" — only re-throws
 * `UnresolvedPlaceholdersError`, which always indicates a caller bug.
 */

export interface LoadLocalePromptOptions {
	requestedLocaleId: string | null | undefined;
	key: string;
	hardcodedFallback: string;
	extraVariables?: TemplateVariables;
	logContext?: Record<string, unknown>;
}

export interface LoadLocalePromptResult {
	systemPrompt: string;
	resolvedLocaleId: string | null;
	languageCode: string | null;
	countryCode: string | null;
	usedFallback: boolean;
	usedHardcodedDefault: boolean;
}

// ── module-scope cache (per-process) ─────────────────────────
// undefined = not looked up yet; null = lookup done, row absent.
let cachedFallbackLocaleId: string | null | undefined;

async function getFallbackLocaleId(db: DbClient): Promise<string | null> {
	if (cachedFallbackLocaleId !== undefined) return cachedFallbackLocaleId;
	const { localeQueries } = await import("@beacon/db");
	const row = await localeQueries.getLocaleByCode(db, "DE", "de");
	cachedFallbackLocaleId = row?.id ?? null;
	return cachedFallbackLocaleId;
}

/** Exported for tests only. */
export function __resetLocalePromptCache(): void {
	cachedFallbackLocaleId = undefined;
}

export async function loadLocalePrompt(
	db: DbClient,
	opts: LoadLocalePromptOptions,
): Promise<LoadLocalePromptResult> {
	const log = createJobLogger({
		queue: "locale-prompt",
		jobId: "loader",
		scanId: "n/a",
	});
	const { localeQueries } = await import("@beacon/db");
	const { renderLocalePromptTemplate, buildLocaleVariables, UnresolvedPlaceholdersError } =
		await import("@beacon/ai");

	const fallbackLocaleId = await getFallbackLocaleId(db);

	// Resolve the "active" locale id (for variable assembly + primary lookup).
	const activeLocaleId = opts.requestedLocaleId ?? fallbackLocaleId;

	let activeLocale: Awaited<ReturnType<typeof localeQueries.getLocaleById>> | undefined;
	if (activeLocaleId) {
		activeLocale = await localeQueries.getLocaleById(db, activeLocaleId);
	}

	const baseVars: TemplateVariables = activeLocale
		? buildLocaleVariables({
				countryCode: activeLocale.countryCode,
				languageCode: activeLocale.languageCode,
				displayName: activeLocale.displayName,
				regionContext: (activeLocale.regionContext as Record<string, unknown> | null) ?? null,
			})
		: {};
	const variables: TemplateVariables = { ...baseVars, ...(opts.extraVariables ?? {}) };

	if (activeLocaleId) {
		try {
			const rendered = await renderLocalePromptTemplate(db, {
				localeId: activeLocaleId,
				key: opts.key,
				fallbackLocaleId:
					fallbackLocaleId && fallbackLocaleId !== activeLocaleId ? fallbackLocaleId : undefined,
				variables,
			});
			const usedFallback =
				rendered.usedFallback || activeLocaleId !== (opts.requestedLocaleId ?? null);
			log.info("prompt.locale.resolved", {
				...(opts.logContext ?? {}),
				requestedLocaleId: opts.requestedLocaleId ?? null,
				resolvedLocaleId: activeLocaleId,
				countryCode: activeLocale?.countryCode ?? null,
				languageCode: activeLocale?.languageCode ?? null,
				templateKey: opts.key,
				usedFallback,
				usedHardcodedDefault: false,
			});
			return {
				systemPrompt: rendered.rendered,
				resolvedLocaleId: activeLocaleId,
				languageCode: activeLocale?.languageCode ?? null,
				countryCode: activeLocale?.countryCode ?? null,
				usedFallback,
				usedHardcodedDefault: false,
			};
		} catch (err) {
			if (err instanceof UnresolvedPlaceholdersError) throw err;
			log.warn("prompt.locale.resolve_failed", {
				...(opts.logContext ?? {}),
				requestedLocaleId: opts.requestedLocaleId ?? null,
				resolvedLocaleId: activeLocaleId,
				templateKey: opts.key,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	log.info("prompt.locale.resolved", {
		...(opts.logContext ?? {}),
		requestedLocaleId: opts.requestedLocaleId ?? null,
		resolvedLocaleId: null,
		countryCode: null,
		languageCode: null,
		templateKey: opts.key,
		usedFallback: false,
		usedHardcodedDefault: true,
	});
	return {
		systemPrompt: opts.hardcodedFallback,
		resolvedLocaleId: null,
		languageCode: null,
		countryCode: null,
		usedFallback: false,
		usedHardcodedDefault: true,
	};
}
