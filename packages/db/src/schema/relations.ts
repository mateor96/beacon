import { relations } from "drizzle-orm";
import { alerts } from "./alerts";
import { apiKeys } from "./api-keys";
import { benchmarkGroups } from "./benchmarks";
import { siteCrawls } from "./crawls";
import { monitoringProjects } from "./monitoring";
import { profiles } from "./profiles";
import { scans } from "./scans";

export const profilesRelations = relations(profiles, ({ many }) => ({
	scans: many(scans),
	monitoringProjects: many(monitoringProjects),
	siteCrawls: many(siteCrawls),
	benchmarkGroups: many(benchmarkGroups),
	alerts: many(alerts),
	apiKeys: many(apiKeys),
}));

export const scansRelations = relations(scans, ({ one }) => ({
	user: one(profiles, {
		fields: [scans.userId],
		references: [profiles.id],
	}),
}));
