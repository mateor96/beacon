import { db, monitoringQueries } from "@beacon/db";
import { createSystemLogger } from "../../lib/logger.js";
import { buildRedditClient, isConfigured } from "../../lib/reddit/client.js";
import { type BrandForDiscovery, runRedditDiscovery } from "../../lib/reddit/discovery.js";
import type { CronJobDefinition } from "../types.js";

const log = createSystemLogger({ service: "worker", component: "cron:reddit-discovery" });

/**
 * Hourly Reddit-mention discovery across all monitoring projects.
 * Skips entirely when REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET are
 * unset; the live HTTP client is a follow-up.
 */
export const redditDiscoveryJob: CronJobDefinition = {
	name: "reddit-discovery",
	pattern: "@hourly",
	handler: async (): Promise<Record<string, unknown>> => {
		if (!isConfigured()) {
			log.info("Reddit not configured, skipping discovery sweep");
			return { skipped: true, reason: "REDDIT credentials unset" };
		}

		const projects = await monitoringQueries.listAllProjects(db);
		const brands: BrandForDiscovery[] = projects.map((p) => ({
			brandId: p.id,
			keywords: p.brandKeywords,
			// In v0.2 every instance-project is reddit-enabled. If/when
			// per-project toggles return, read from the schema column.
			redditEnabled: true,
		}));

		const result = await runRedditDiscovery({
			client: buildRedditClient(),
			brands,
			logger: log,
		});

		return { ...result };
	},
	description: "Hourly Reddit-mention discovery across monitoring brands",
};
