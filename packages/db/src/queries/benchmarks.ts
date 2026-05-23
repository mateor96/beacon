import { eq } from "drizzle-orm";
import type { DbClient } from "../client";
import { benchmarkGroups } from "../schema/benchmarks";
import type { NewBenchmarkGroup } from "../types";
import { requireFirstRow } from "./utils";

export function create(db: DbClient, data: NewBenchmarkGroup) {
	return db
		.insert(benchmarkGroups)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "benchmarks.create"));
}

export function getById(db: DbClient, id: string) {
	return db.query.benchmarkGroups.findFirst({
		where: eq(benchmarkGroups.id, id),
	});
}

export function getByUserId(db: DbClient, userId: string) {
	return db.query.benchmarkGroups.findMany({
		where: eq(benchmarkGroups.userId, userId),
	});
}

export function deleteById(db: DbClient, id: string) {
	return db
		.delete(benchmarkGroups)
		.where(eq(benchmarkGroups.id, id))
		.returning()
		.then((rows) => rows[0]);
}
