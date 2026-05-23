import { and, desc, eq, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import { alertEvents, alerts } from "../schema/alerts";
import type { NewAlert, NewAlertEvent } from "../types";
import { requireFirstRow } from "./utils";

// Alerts
export function create(db: DbClient, data: NewAlert) {
	return db
		.insert(alerts)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "alerts.create"));
}

export function getById(db: DbClient, id: string) {
	return db.query.alerts.findFirst({
		where: eq(alerts.id, id),
		with: { events: true },
	});
}

export function getByUserId(db: DbClient, userId: string) {
	return db.query.alerts.findMany({
		where: eq(alerts.userId, userId),
	});
}

export function update(
	db: DbClient,
	id: string,
	data: Partial<Pick<NewAlert, "type" | "channel" | "config" | "enabled">>,
) {
	return db
		.update(alerts)
		.set(data)
		.where(eq(alerts.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function deleteById(db: DbClient, id: string) {
	return db
		.delete(alerts)
		.where(eq(alerts.id, id))
		.returning()
		.then((rows) => rows[0]);
}

// Alert Events
export function createEvent(db: DbClient, data: NewAlertEvent) {
	return db
		.insert(alertEvents)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "alerts.createEvent"));
}

// ─── Alert evaluation queries (#286) ────────────────────────

/**
 * Get enabled alerts for a specific project. Matches alerts where
 * config->>'projectId' equals the given projectId.
 */
export function getEnabledByProjectId(db: DbClient, projectId: string) {
	return db.query.alerts.findMany({
		where: and(eq(alerts.enabled, true), sql`${alerts.config}->>'projectId' = ${projectId}`),
	});
}

/**
 * Get enabled alerts for a user across all projects.
 */
export function getEnabledByUserId(db: DbClient, userId: string) {
	return db.query.alerts.findMany({
		where: and(eq(alerts.userId, userId), eq(alerts.enabled, true)),
	});
}

export function getEventsByAlertId(
	db: DbClient,
	alertId: string,
	opts: { limit?: number; offset?: number } = {},
) {
	const { limit = 20, offset = 0 } = opts;
	return db.query.alertEvents.findMany({
		where: eq(alertEvents.alertId, alertId),
		orderBy: desc(alertEvents.sentAt),
		limit,
		offset,
	});
}
