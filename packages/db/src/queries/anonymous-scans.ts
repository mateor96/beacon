import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import { anonymousScans } from "../schema/anonymous-scans";
import { requireFirstRow } from "./utils";

export function getByIpHashAndDate(db: DbClient, ipHash: string, scanDate: string) {
	return db.query.anonymousScans.findFirst({
		where: and(eq(anonymousScans.ipHash, ipHash), eq(anonymousScans.scanDate, scanDate)),
	});
}

export function increment(db: DbClient, id: string) {
	return db
		.update(anonymousScans)
		.set({ scanCount: sql`${anonymousScans.scanCount} + 1` })
		.where(eq(anonymousScans.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function create(db: DbClient, ipHash: string) {
	return db
		.insert(anonymousScans)
		.values({ ipHash })
		.returning()
		.then((rows) => requireFirstRow(rows, "anonymousScans.create"));
}
