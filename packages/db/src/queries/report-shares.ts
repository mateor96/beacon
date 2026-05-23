import { and, desc, eq, gt, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import { type NewReportShare, reportShares } from "../schema/report-shares";
import { requireFirstRow } from "./utils";

export function createShare(db: DbClient, data: NewReportShare) {
	return db
		.insert(reportShares)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "reportShares.create"));
}

/** Returns the share only when active AND not expired. */
export function getActiveByToken(db: DbClient, token: string) {
	return db.query.reportShares.findFirst({
		where: and(
			eq(reportShares.shareToken, token),
			eq(reportShares.isActive, true),
			gt(reportShares.expiresAt, sql`NOW()`),
		),
	});
}

/** Raw lookup (no active/expiry filter) — used for admin/debug + to distinguish 404 vs 410. */
export function getByToken(db: DbClient, token: string) {
	return db.query.reportShares.findFirst({
		where: eq(reportShares.shareToken, token),
	});
}

export function getById(db: DbClient, id: string) {
	return db.query.reportShares.findFirst({ where: eq(reportShares.id, id) });
}

export function listForUser(db: DbClient, userId: string, opts: { scanId?: string } = {}) {
	const conds = [eq(reportShares.userId, userId)];
	if (opts.scanId) conds.push(eq(reportShares.reportId, opts.scanId));
	return db.query.reportShares.findMany({
		where: and(...conds),
		orderBy: desc(reportShares.createdAt),
	});
}

/** Revoke — scoped by userId to prevent cross-tenant revokes. */
export function revoke(db: DbClient, id: string, userId: string) {
	return db
		.update(reportShares)
		.set({ isActive: false, revokedAt: new Date() })
		.where(and(eq(reportShares.id, id), eq(reportShares.userId, userId)))
		.returning()
		.then((rows) => rows[0]);
}

export function recordAccess(db: DbClient, id: string) {
	return db
		.update(reportShares)
		.set({
			lastAccessedAt: new Date(),
			accessCount: sql`${reportShares.accessCount} + 1`,
		})
		.where(eq(reportShares.id, id))
		.returning({ id: reportShares.id });
}

export function cleanupExpired(db: DbClient) {
	return db
		.update(reportShares)
		.set({ isActive: false })
		.where(and(eq(reportShares.isActive, true), sql`${reportShares.expiresAt} < NOW()`))
		.returning({ id: reportShares.id });
}
