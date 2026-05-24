import { desc, eq } from "drizzle-orm";
import type { DbClient } from "../client";
import { emailLog, userEmailPreferences } from "../schema/email";
import type { NewEmailLog } from "../types";

export function insertEmailLog(db: DbClient, data: NewEmailLog) {
	return db
		.insert(emailLog)
		.values(data)
		.onConflictDoNothing({ target: emailLog.idempotencyKey })
		.returning()
		.then((rows) => rows[0] ?? null);
}

export function updateEmailLogStatus(
	db: DbClient,
	id: string,
	updates: {
		status?: "queued" | "sent" | "failed" | "suppressed";
		sentAt?: Date;
		providerMessageId?: string;
		errorMessage?: string | null;
	},
) {
	return db
		.update(emailLog)
		.set(updates)
		.where(eq(emailLog.id, id))
		.returning()
		.then((rows) => rows[0]);
}

/**
 * Lists recent email-log entries (newest first) for the operator status page.
 * Instance-wide — no user scoping, matching the anonymous instance model.
 */
export function listRecentEmailLogs(db: DbClient, opts: { limit?: number; offset?: number } = {}) {
	const { limit = 50, offset = 0 } = opts;
	return db.select().from(emailLog).orderBy(desc(emailLog.createdAt)).limit(limit).offset(offset);
}

export function getEmailLogByIdempotencyKey(db: DbClient, key: string) {
	return db.query.emailLog.findFirst({
		where: eq(emailLog.idempotencyKey, key),
	});
}

export function getAllPreferencesForUser(db: DbClient, userId: string) {
	return db.query.userEmailPreferences.findMany({
		where: (table, { eq: e }) => e(table.userId, userId),
	});
}

export function getUserEmailPreference(db: DbClient, userId: string, category: string) {
	return db.query.userEmailPreferences.findFirst({
		where: (table, { and, eq: e }) => and(e(table.userId, userId), e(table.category, category)),
	});
}

export function upsertEmailPreference(
	db: DbClient,
	userId: string,
	category: string,
	enabled: boolean,
) {
	return db
		.insert(userEmailPreferences)
		.values({ userId, category, enabled })
		.onConflictDoUpdate({
			target: [userEmailPreferences.userId, userEmailPreferences.category],
			set: { enabled, updatedAt: new Date() },
		})
		.returning()
		.then((rows) => rows[0]);
}
