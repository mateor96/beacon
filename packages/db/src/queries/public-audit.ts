import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import {
	publicAuditRequests,
	publicAuditResults,
	publicConversionEvents,
	publicLeads,
} from "../schema/public-audit";
import type {
	NewPublicAuditRequest,
	NewPublicAuditResult,
	NewPublicConversionEvent,
	NewPublicLead,
} from "../types";

export function createRequest(db: DbClient, data: NewPublicAuditRequest) {
	return db
		.insert(publicAuditRequests)
		.values(data)
		.returning()
		.then((rows) => rows[0]);
}

export function getRequestById(db: DbClient, id: string) {
	return db.query.publicAuditRequests.findFirst({
		where: eq(publicAuditRequests.id, id),
	});
}

export function updateRequestStatus(
	db: DbClient,
	id: string,
	status: "pending" | "processing" | "completed" | "failed",
) {
	return db
		.update(publicAuditRequests)
		.set({ status, updatedAt: new Date() })
		.where(eq(publicAuditRequests.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function createResult(db: DbClient, data: NewPublicAuditResult) {
	return db
		.insert(publicAuditResults)
		.values(data)
		.returning()
		.then((rows) => rows[0]);
}

export function getResultByRequestId(db: DbClient, requestId: string) {
	return db.query.publicAuditResults.findFirst({
		where: eq(publicAuditResults.requestId, requestId),
	});
}

export function createLead(db: DbClient, data: NewPublicLead) {
	return db
		.insert(publicLeads)
		.values(data)
		.returning()
		.then((rows) => rows[0]);
}

export function createConversionEvent(db: DbClient, data: NewPublicConversionEvent) {
	return db
		.insert(publicConversionEvents)
		.values(data)
		.returning()
		.then((rows) => rows[0]);
}

export function createLeadOrIgnore(db: DbClient, data: NewPublicLead) {
	return db
		.insert(publicLeads)
		.values(data)
		.onConflictDoNothing({ target: publicLeads.requestId })
		.returning()
		.then((rows) => rows[0] ?? null);
}

// ── Aggregation queries for the admin dashboard (#200 + #236) ──

/**
 * Counts per-event-type over the given window. Returns one row per event
 * type actually observed in the window (missing types simply absent).
 */
export function countEventsByType(db: DbClient, since: Date) {
	return db
		.select({
			eventType: publicConversionEvents.eventType,
			count: sql<number>`COUNT(*)::int`.as("count"),
		})
		.from(publicConversionEvents)
		.where(sql`${publicConversionEvents.createdAt} >= ${since}`)
		.groupBy(publicConversionEvents.eventType);
}

export function countAuditsInWindow(db: DbClient, since: Date) {
	return db
		.select({ count: sql<number>`COUNT(*)::int`.as("count") })
		.from(publicAuditRequests)
		.where(sql`${publicAuditRequests.createdAt} >= ${since}`)
		.then((rows) => rows[0]?.count ?? 0);
}

export function countLeadsInWindow(db: DbClient, since: Date) {
	return db
		.select({ count: sql<number>`COUNT(*)::int`.as("count") })
		.from(publicLeads)
		.where(sql`${publicLeads.createdAt} >= ${since}`)
		.then((rows) => rows[0]?.count ?? 0);
}

export function findConversionEvent(
	db: DbClient,
	requestId: string,
	eventType:
		| "page_visit"
		| "audit_submitted"
		| "teaser_viewed"
		| "email_entered"
		| "report_viewed"
		| "signup_initiated",
) {
	return db.query.publicConversionEvents.findFirst({
		where: and(
			eq(publicConversionEvents.requestId, requestId),
			eq(publicConversionEvents.eventType, eventType),
		),
	});
}
