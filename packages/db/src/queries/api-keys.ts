import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { DbClient } from "../client";
import { apiKeys } from "../schema/api-keys";
import type { NewApiKey } from "../types";
import { requireFirstRow } from "./utils";

export function create(db: DbClient, data: NewApiKey) {
	return db
		.insert(apiKeys)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "apiKeys.create"));
}

export function getByPrefix(db: DbClient, prefix: string) {
	return db.query.apiKeys.findFirst({
		where: eq(apiKeys.prefix, prefix),
	});
}

export function getActiveByPrefix(db: DbClient, prefix: string) {
	return db.query.apiKeys.findFirst({
		where: and(
			eq(apiKeys.prefix, prefix),
			or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, new Date())),
		),
	});
}

export function getByUserId(db: DbClient, userId: string) {
	return db.query.apiKeys.findMany({
		where: eq(apiKeys.userId, userId),
	});
}

export function updateLastUsed(db: DbClient, id: string) {
	return db
		.update(apiKeys)
		.set({ lastUsedAt: new Date() })
		.where(eq(apiKeys.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function deleteById(db: DbClient, id: string) {
	return db
		.delete(apiKeys)
		.where(eq(apiKeys.id, id))
		.returning()
		.then((rows) => rows[0]);
}
