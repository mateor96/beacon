import type { DbClient, PromptTemplate } from "@beacon/db";

/**
 * Locale-aware prompt template engine.
 *
 * Templates are stored in the `prompt_templates` table keyed by
 * `(locale_id, key)`. The renderer replaces `{{variable}}` placeholders
 * with values from a flat string map. Falls back to a default locale
 * (typically de-DE) when no locale-specific template exists.
 */

export const TEMPLATE_PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export type TemplateVariables = Record<string, string | number | boolean | null | undefined>;

/**
 * Replaces `{{var}}` placeholders with values from `vars`. Unknown placeholders
 * are left intact so `validateRendered` can flag them.
 */
export function renderTemplate(template: string, vars: TemplateVariables): string {
	return template.replace(TEMPLATE_PLACEHOLDER_RE, (match, name: string) => {
		const value = vars[name];
		if (value === undefined || value === null) return match;
		return String(value);
	});
}

/**
 * Returns the list of placeholder names still present in the rendered text.
 * Empty array means the prompt is fully resolved.
 */
export function findUnresolvedPlaceholders(text: string): string[] {
	const out: string[] = [];
	for (const m of text.matchAll(TEMPLATE_PLACEHOLDER_RE)) {
		const name = m[1];
		if (name && !out.includes(name)) out.push(name);
	}
	return out;
}

export class UnresolvedPlaceholdersError extends Error {
	constructor(
		public readonly placeholders: string[],
		public readonly templateKey: string,
	) {
		super(
			`Prompt-Template "${templateKey}" enthält nicht aufgelöste Platzhalter: ${placeholders.join(", ")}`,
		);
		this.name = "UnresolvedPlaceholdersError";
	}
}

/** Renders and asserts no `{{...}}` placeholders remain. */
export function renderAndValidate(
	template: string,
	vars: TemplateVariables,
	templateKey: string,
): string {
	const rendered = renderTemplate(template, vars);
	const unresolved = findUnresolvedPlaceholders(rendered);
	if (unresolved.length > 0) {
		throw new UnresolvedPlaceholdersError(unresolved, templateKey);
	}
	return rendered;
}

export interface ResolveTemplateOptions {
	/** Locale ID to look up first. */
	localeId: string;
	/** Template key (e.g. "readiness_check"). */
	key: string;
	/** Locale ID to fall back to when the locale-specific template is missing. */
	fallbackLocaleId?: string;
}

export interface ResolvedPromptTemplate {
	template: PromptTemplate;
	usedFallback: boolean;
}

/**
 * Fetches the template for the given locale. If absent and a fallback locale
 * is provided, returns the fallback template. Returns null when neither exists.
 */
export async function resolveLocalePromptTemplate(
	db: DbClient,
	opts: ResolveTemplateOptions,
): Promise<ResolvedPromptTemplate | null> {
	const { localeQueries } = await import("@beacon/db");
	const primary = await localeQueries.getTemplate(db, opts.localeId, opts.key);
	if (primary) return { template: primary, usedFallback: false };

	if (opts.fallbackLocaleId && opts.fallbackLocaleId !== opts.localeId) {
		const fallback = await localeQueries.getTemplate(db, opts.fallbackLocaleId, opts.key);
		if (fallback) return { template: fallback, usedFallback: true };
	}
	return null;
}

/**
 * Convenience: resolve a template, render it with the given variables, and
 * assert all placeholders are filled. Returns the rendered string and the
 * source template (so callers can also access `category`, `variables`, etc.).
 */
export async function renderLocalePromptTemplate(
	db: DbClient,
	opts: ResolveTemplateOptions & { variables: TemplateVariables },
): Promise<{ rendered: string; template: PromptTemplate; usedFallback: boolean }> {
	const resolved = await resolveLocalePromptTemplate(db, opts);
	if (!resolved) {
		throw new Error(
			`Kein Prompt-Template gefunden für locale=${opts.localeId} key=${opts.key}${opts.fallbackLocaleId ? ` (Fallback ${opts.fallbackLocaleId} ebenfalls leer)` : ""}`,
		);
	}
	const rendered = renderAndValidate(resolved.template.content, opts.variables, opts.key);
	return { rendered, template: resolved.template, usedFallback: resolved.usedFallback };
}

/**
 * Builds the standard variable bag from a locale row. Pulls `regionContext`
 * fields into top-level placeholders so templates can reference
 * `{{local_ai_assistants}}`, `{{search_engines}}` etc. directly.
 */
export function buildLocaleVariables(locale: {
	countryCode: string;
	languageCode: string;
	displayName: string;
	regionContext: Record<string, unknown> | null;
}): TemplateVariables {
	const ctx = locale.regionContext ?? {};
	const out: TemplateVariables = {
		country: locale.countryCode,
		language: locale.languageCode,
		display_name: locale.displayName,
	};
	for (const [k, v] of Object.entries(ctx)) {
		if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
			out[k] = v;
		} else if (Array.isArray(v)) {
			out[k] = v.filter((x) => typeof x === "string" || typeof x === "number").join(", ");
		}
	}
	return out;
}
