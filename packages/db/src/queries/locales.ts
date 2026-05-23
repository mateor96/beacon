import { and, asc, eq } from "drizzle-orm";
import type { DbClient } from "../client";
import {
	type NewDomainLocale,
	type NewLocale,
	type NewPromptTemplate,
	domainLocales,
	locales,
	promptTemplates,
} from "../schema/locales";
import { requireFirstRow } from "./utils";

// ── locale CRUD ─────────────────────────────────────────────

export function getLocaleById(db: DbClient, id: string) {
	return db.query.locales.findFirst({ where: eq(locales.id, id) });
}

export function getLocaleByCode(db: DbClient, countryCode: string, languageCode: string) {
	return db.query.locales.findFirst({
		where: and(eq(locales.countryCode, countryCode), eq(locales.languageCode, languageCode)),
	});
}

export function listActiveLocales(db: DbClient) {
	return db.query.locales.findMany({
		where: eq(locales.isActive, true),
		orderBy: [asc(locales.countryCode), asc(locales.languageCode)],
	});
}

export function listAllLocales(db: DbClient) {
	return db.query.locales.findMany({
		orderBy: [asc(locales.countryCode), asc(locales.languageCode)],
	});
}

export function createLocale(db: DbClient, data: NewLocale) {
	return db
		.insert(locales)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "locales.create"));
}

/** Idempotent insert; returns null when (country_code, language_code) already exists. */
export function createLocaleIdempotent(db: DbClient, data: NewLocale) {
	return db
		.insert(locales)
		.values(data)
		.onConflictDoNothing({ target: [locales.countryCode, locales.languageCode] })
		.returning()
		.then((rows) => rows[0] ?? null);
}

/**
 * Upserts a locale by (country_code, language_code), updating display_name,
 * is_active and region_context on conflict. Returns the resulting row.
 */
export function upsertLocale(db: DbClient, data: NewLocale) {
	return db
		.insert(locales)
		.values(data)
		.onConflictDoUpdate({
			target: [locales.countryCode, locales.languageCode],
			set: {
				displayName: data.displayName,
				isActive: data.isActive ?? true,
				regionContext: data.regionContext ?? null,
			},
		})
		.returning()
		.then((rows) => requireFirstRow(rows, "locales.upsert"));
}

export function updateLocale(
	db: DbClient,
	id: string,
	patch: Partial<{ displayName: string; isActive: boolean }>,
) {
	return db
		.update(locales)
		.set(patch)
		.where(eq(locales.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function setLocaleActive(db: DbClient, id: string, isActive: boolean) {
	return updateLocale(db, id, { isActive });
}

// ── domain_locales management ────────────────────────────────

export function listLocalesForDomain(db: DbClient, domainId: string) {
	return db.query.domainLocales.findMany({
		where: eq(domainLocales.domainId, domainId),
		with: { locale: true },
	});
}

export function getPrimaryLocaleForDomain(db: DbClient, domainId: string) {
	return db.query.domainLocales.findFirst({
		where: and(eq(domainLocales.domainId, domainId), eq(domainLocales.isPrimary, true)),
		with: { locale: true },
	});
}

export function attachLocaleToDomain(db: DbClient, data: NewDomainLocale) {
	return db
		.insert(domainLocales)
		.values(data)
		.onConflictDoNothing({ target: [domainLocales.domainId, domainLocales.localeId] })
		.returning()
		.then((rows) => rows[0] ?? null);
}

export function detachLocaleFromDomain(db: DbClient, domainId: string, localeId: string) {
	return db
		.delete(domainLocales)
		.where(and(eq(domainLocales.domainId, domainId), eq(domainLocales.localeId, localeId)))
		.returning({ id: domainLocales.id });
}

/**
 * Atomically flips which locale is primary for a domain.
 * Relies on the partial unique index `idx_domain_locales_primary_uniq` to
 * guarantee at most one primary; the transaction prevents observing a state
 * where the domain has zero primaries.
 */
export async function setPrimaryLocale(db: DbClient, domainId: string, localeId: string) {
	await db.transaction(async (tx) => {
		await tx
			.update(domainLocales)
			.set({ isPrimary: false })
			.where(and(eq(domainLocales.domainId, domainId), eq(domainLocales.isPrimary, true)));
		await tx
			.update(domainLocales)
			.set({ isPrimary: true })
			.where(and(eq(domainLocales.domainId, domainId), eq(domainLocales.localeId, localeId)));
	});
}

// ── prompt templates ─────────────────────────────────────────

export function listTemplatesByLocale(db: DbClient, localeId: string) {
	return db.query.promptTemplates.findMany({
		where: eq(promptTemplates.localeId, localeId),
		orderBy: [asc(promptTemplates.key)],
	});
}

export function getTemplate(db: DbClient, localeId: string, key: string) {
	return db.query.promptTemplates.findFirst({
		where: and(eq(promptTemplates.localeId, localeId), eq(promptTemplates.key, key)),
	});
}

export function upsertTemplate(db: DbClient, data: NewPromptTemplate) {
	return db
		.insert(promptTemplates)
		.values(data)
		.onConflictDoUpdate({
			target: [promptTemplates.localeId, promptTemplates.key],
			set: {
				content: data.content,
				category: data.category ?? null,
				variables: data.variables ?? null,
				isActive: data.isActive ?? true,
			},
		})
		.returning()
		.then((rows) => requireFirstRow(rows, "promptTemplates.upsert"));
}

export function deleteTemplate(db: DbClient, id: string) {
	return db
		.delete(promptTemplates)
		.where(eq(promptTemplates.id, id))
		.returning({ id: promptTemplates.id });
}
