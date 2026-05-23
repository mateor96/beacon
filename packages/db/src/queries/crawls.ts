import { and, desc, eq } from "drizzle-orm";
import type { DbClient } from "../client";
import { siteCrawlPages, siteCrawls } from "../schema/crawls";
import type { NewSiteCrawl, NewSiteCrawlPage } from "../types";
import { requireFirstRow } from "./utils";

// Crawls
export function create(db: DbClient, data: NewSiteCrawl) {
	return db
		.insert(siteCrawls)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "crawls.create"));
}

export function getById(db: DbClient, id: string) {
	return db.query.siteCrawls.findFirst({
		where: eq(siteCrawls.id, id),
		with: { pages: true },
	});
}

export function listAll(db: DbClient, opts: { limit?: number; offset?: number } = {}) {
	const { limit = 20, offset = 0 } = opts;
	return db.query.siteCrawls.findMany({
		orderBy: desc(siteCrawls.startedAt),
		limit,
		offset,
	});
}

export function listForProject(
	db: DbClient,
	monitoringProjectId: string,
	opts: { limit?: number } = {},
) {
	const { limit = 20 } = opts;
	return db.query.siteCrawls.findMany({
		where: eq(siteCrawls.monitoringProjectId, monitoringProjectId),
		orderBy: desc(siteCrawls.startedAt),
		limit,
	});
}

export function updateStatus(
	db: DbClient,
	id: string,
	status: "pending" | "crawling" | "completed" | "failed",
	completedAt?: Date,
) {
	return db
		.update(siteCrawls)
		.set({
			status,
			...(completedAt !== undefined && { completedAt }),
		})
		.where(eq(siteCrawls.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function updateStats(
	db: DbClient,
	id: string,
	data: {
		pagesFound?: number;
		pagesScanned?: number;
		avgScore?: number;
		weakestPages?: unknown;
	},
) {
	return db
		.update(siteCrawls)
		.set(data)
		.where(eq(siteCrawls.id, id))
		.returning()
		.then((rows) => rows[0]);
}

// Pages
export function addPage(db: DbClient, data: NewSiteCrawlPage) {
	return db
		.insert(siteCrawlPages)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "crawls.addPage"));
}

export function addPages(db: DbClient, data: NewSiteCrawlPage[]) {
	if (data.length === 0) return Promise.resolve([]);
	return db.insert(siteCrawlPages).values(data).returning();
}

export function getPages(db: DbClient, crawlId: string) {
	return db.query.siteCrawlPages.findMany({
		where: eq(siteCrawlPages.crawlId, crawlId),
	});
}

export function getPendingPages(db: DbClient, crawlId: string) {
	return db.query.siteCrawlPages.findMany({
		where: and(eq(siteCrawlPages.crawlId, crawlId), eq(siteCrawlPages.status, "pending")),
	});
}

export function updatePageStatus(
	db: DbClient,
	id: string,
	status: "pending" | "scanning" | "completed" | "failed",
	scanId?: string,
) {
	return db
		.update(siteCrawlPages)
		.set({
			status,
			...(scanId !== undefined && { scanId }),
		})
		.where(eq(siteCrawlPages.id, id))
		.returning()
		.then((rows) => rows[0]);
}
