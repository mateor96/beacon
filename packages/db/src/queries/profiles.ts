import type { BrandingConfig } from "@beacon/shared";
import { eq } from "drizzle-orm";
import type { DbClient } from "../client";
import { profiles } from "../schema/profiles";
import type { NewProfile } from "../types";
import { requireFirstRow } from "./utils";

export function ensureProfile(db: DbClient, data: { id: string; email: string }) {
	return db
		.insert(profiles)
		.values(data)
		.onConflictDoUpdate({ target: profiles.id, set: { email: data.email } })
		.returning()
		.then((rows) => requireFirstRow(rows, "profiles.ensureProfile"));
}

export function getById(db: DbClient, id: string) {
	return db.query.profiles.findFirst({ where: eq(profiles.id, id) });
}

export function create(db: DbClient, data: NewProfile) {
	return db
		.insert(profiles)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "profiles.create"));
}

export function getBranding(db: DbClient, userId: string) {
	return db
		.select({ reportBranding: profiles.reportBranding })
		.from(profiles)
		.where(eq(profiles.id, userId))
		.then((rows) => rows[0]?.reportBranding ?? null);
}

export function updateBranding(db: DbClient, userId: string, branding: BrandingConfig) {
	return db
		.update(profiles)
		.set({ reportBranding: branding })
		.where(eq(profiles.id, userId))
		.returning()
		.then((rows) => rows[0]);
}

export function deleteById(db: DbClient, id: string) {
	return db
		.delete(profiles)
		.where(eq(profiles.id, id))
		.returning()
		.then((rows) => rows[0]);
}
