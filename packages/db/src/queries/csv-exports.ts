import { and, desc, eq, lt } from "drizzle-orm";
import type { DbClient } from "../client";
import { type CsvExportStatus, type NewCsvExport, csvExports } from "../schema/csv-exports";
import { requireFirstRow } from "./utils";

export function create(db: DbClient, data: NewCsvExport) {
	return db
		.insert(csvExports)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "csvExports.create"));
}

export function getById(db: DbClient, id: string) {
	return db.query.csvExports.findFirst({ where: eq(csvExports.id, id) });
}

export function listAll(db: DbClient, limit = 20) {
	return db.query.csvExports.findMany({
		orderBy: desc(csvExports.createdAt),
		limit,
	});
}

export function updateStatus(
	db: DbClient,
	id: string,
	status: CsvExportStatus,
	patch: {
		progress?: number;
		rowCount?: number;
		fileBytes?: number;
		storageKey?: string | null;
		downloadUrl?: string | null;
		urlExpiresAt?: Date | null;
		errorMessage?: string | null;
		startedAt?: Date;
		completedAt?: Date;
	} = {},
) {
	return db
		.update(csvExports)
		.set({ status, ...patch })
		.where(eq(csvExports.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function expireStaleUrls(db: DbClient, now: Date) {
	return db
		.update(csvExports)
		.set({ status: "expired", downloadUrl: null })
		.where(and(eq(csvExports.status, "completed"), lt(csvExports.urlExpiresAt, now)))
		.returning({ id: csvExports.id });
}
