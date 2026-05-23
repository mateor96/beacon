import { relations } from "drizzle-orm";
import { alerts } from "./alerts";
import { benchmarkGroups } from "./benchmarks";
import { siteCrawls } from "./crawls";
import { profiles } from "./profiles";
import { scans } from "./scans";

export const profilesRelations = relations(profiles, ({ many }) => ({
	scans: many(scans),
	siteCrawls: many(siteCrawls),
	benchmarkGroups: many(benchmarkGroups),
	alerts: many(alerts),
}));

export const scansRelations = relations(scans, ({ one }) => ({
	user: one(profiles, {
		fields: [scans.userId],
		references: [profiles.id],
	}),
}));
