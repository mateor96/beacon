import { count, eq } from "drizzle-orm";
import type { DbClient } from "../client";
import { waitlistSignups } from "../schema/waitlist";
import { requireFirstRow } from "./utils";

export interface CreateWaitlistSignupData {
	email: string;
	companyName?: string | null;
	websiteUrl?: string | null;
	confirmToken: string;
	source?: string | null;
}

/**
 * Create a waitlist signup. Uses ON CONFLICT to handle duplicate emails —
 * if the email already exists, updates the confirm token instead.
 */
export function create(db: DbClient, data: CreateWaitlistSignupData) {
	return db
		.insert(waitlistSignups)
		.values({
			email: data.email,
			companyName: data.companyName ?? null,
			websiteUrl: data.websiteUrl ?? null,
			confirmToken: data.confirmToken,
			source: data.source ?? "landing",
		})
		.onConflictDoUpdate({
			target: waitlistSignups.email,
			set: {
				confirmToken: data.confirmToken,
				companyName: data.companyName ?? null,
				websiteUrl: data.websiteUrl ?? null,
				source: data.source ?? "landing",
			},
		})
		.returning()
		.then((rows) => requireFirstRow(rows, "waitlistSignups.create"));
}

/**
 * Get a waitlist signup by email address.
 */
export function getByEmail(db: DbClient, email: string) {
	return db.query.waitlistSignups.findFirst({
		where: eq(waitlistSignups.email, email),
	});
}

/**
 * Get a waitlist signup by confirmation token.
 */
export function getByToken(db: DbClient, token: string) {
	return db.query.waitlistSignups.findFirst({
		where: eq(waitlistSignups.confirmToken, token),
	});
}

/**
 * Confirm a waitlist signup by setting status to "confirmed" and recording the timestamp.
 */
export function confirm(db: DbClient, id: string) {
	return db
		.update(waitlistSignups)
		.set({
			status: "confirmed",
			confirmedAt: new Date(),
		})
		.where(eq(waitlistSignups.id, id))
		.returning()
		.then((rows) => rows[0]);
}

/**
 * Count the number of confirmed waitlist signups.
 */
export function countConfirmed(db: DbClient) {
	return db
		.select({ count: count() })
		.from(waitlistSignups)
		.where(eq(waitlistSignups.status, "confirmed"))
		.then((rows) => rows[0]?.count ?? 0);
}
