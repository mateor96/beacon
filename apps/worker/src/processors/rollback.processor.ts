/**
 * Rollback processor (#291).
 *
 * Reverses a succeeded deployment by dispatching to CMS-specific rollback
 * logic. The actual CMS API calls are TODO stubs until #280/#284/#290 land.
 */

import type { RollbackJobData, RollbackJobResult } from "@beacon/queue";
import type { RollbackPayload } from "@beacon/shared";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";

export async function processRollback(
	job: Job<RollbackJobData, RollbackJobResult>,
): Promise<RollbackJobResult> {
	const { deploymentAttemptId, triggeredBy } = job.data;
	const log = createJobLogger({
		queue: "rollback",
		jobId: job.id ?? "unknown",
		scanId: deploymentAttemptId,
		correlationId: deploymentAttemptId,
	});

	log.info("Processing rollback", { deploymentAttemptId, triggeredBy });

	const { db, fixQueries } = await import("@beacon/db");

	// 1. Fetch deployment attempt
	const attempt = await fixQueries.getDeploymentAttemptById(db, deploymentAttemptId);
	if (!attempt) {
		throw new Error(`Deployment ${deploymentAttemptId} not found`);
	}

	// 2. Validate state transition
	const { assertValidDeploymentTransition } = await import("@beacon/shared");
	assertValidDeploymentTransition(attempt.status as "succeeded", "rolled_back");

	// 3. Read rollback data
	const rollbackData = attempt.rollbackData as RollbackPayload | null;
	if (!rollbackData) {
		throw new Error(`No rollback data for deployment ${deploymentAttemptId}`);
	}

	try {
		// 4. CMS-specific rollback
		switch (rollbackData.cms) {
			case "wordpress": {
				const { db: rollbackDb, fixQueries: rollbackFixQueries } = await import("@beacon/db");
				const { connection: _conn, credentials } =
					await rollbackFixQueries.getDecryptedCmsConnection(rollbackDb, attempt.cmsConnectionId);
				if (credentials.cms !== "wordpress") {
					throw new Error(`Expected wordpress credentials, got ${credentials.cms}`);
				}
				const { WordPressClient } = await import("../lib/wordpress-client.js");
				const wpClient = new WordPressClient({
					baseUrl: credentials.baseUrl,
					username: credentials.username,
					appPassword: credentials.appPassword,
				});
				if (
					rollbackData.strategy === "restore_field" &&
					rollbackData.postId &&
					rollbackData.previousContent
				) {
					await wpClient.updatePage(rollbackData.postId, {
						content: rollbackData.previousContent,
					});
					log.info("WordPress rollback: restored previous content", {
						postId: rollbackData.postId,
					});
				} else if (rollbackData.strategy === "delete_file" && rollbackData.postId) {
					await wpClient.deletePage(rollbackData.postId);
					log.info("WordPress rollback: deleted page", {
						postId: rollbackData.postId,
					});
				} else {
					log.warn("WordPress rollback: unknown strategy or missing data", {
						strategy: rollbackData.strategy,
						postId: rollbackData.postId,
					});
				}
				break;
			}
			case "webflow": {
				const { db: wfDb, fixQueries: wfFixQueries } = await import("@beacon/db");
				const { connection: _wfConn, credentials: wfCreds } =
					await wfFixQueries.getDecryptedCmsConnection(wfDb, attempt.cmsConnectionId);
				if (wfCreds.cms !== "webflow") {
					throw new Error(`Expected webflow credentials, got ${wfCreds.cms}`);
				}
				const { WebflowClient } = await import("../lib/webflow-client.js");
				const wfClient = new WebflowClient({
					siteId: wfCreds.siteId,
					apiToken: wfCreds.apiToken,
				});

				// Restore previous custom code scripts
				const previousScripts = rollbackData.previousFields?.scripts;
				if (Array.isArray(previousScripts)) {
					await wfClient.upsertCustomCode(previousScripts);
					await wfClient.publishSite();
					log.info("Webflow rollback: restored previous custom code", {
						collectionId: rollbackData.collectionId,
						scriptsCount: previousScripts.length,
					});
				} else {
					// No previous scripts — clear custom code
					await wfClient.upsertCustomCode([]);
					await wfClient.publishSite();
					log.info("Webflow rollback: cleared custom code", {
						collectionId: rollbackData.collectionId,
					});
				}
				break;
			}
			case "shopify": {
				const { db: shopifyDb, fixQueries: shopifyFixQueries } = await import("@beacon/db");
				const { connection: _shopifyConn, credentials: shopifyCreds } =
					await shopifyFixQueries.getDecryptedCmsConnection(shopifyDb, attempt.cmsConnectionId);
				if (shopifyCreds.cms !== "shopify") {
					throw new Error(`Expected shopify credentials, got ${shopifyCreds.cms}`);
				}
				const { ShopifyClient } = await import("../lib/shopify-client.js");
				const shopifyClient = new ShopifyClient({
					shopDomain: shopifyCreds.shopDomain,
					accessToken: shopifyCreds.accessToken,
					apiVersion: shopifyCreds.apiVersion,
				});

				// Get main theme
				const themes = await shopifyClient.getThemes();
				const mainTheme = themes.find((t) => t.role === "main");
				if (!mainTheme) {
					throw new Error("Kein aktives Theme gefunden fuer Rollback.");
				}

				if (rollbackData.previousValue) {
					// Restore previous asset content
					await shopifyClient.putAsset(
						mainTheme.id,
						rollbackData.assetKey,
						rollbackData.previousValue,
					);
					log.info("Shopify rollback: restored previous asset", {
						themeId: mainTheme.id,
						assetKey: rollbackData.assetKey,
					});
				} else {
					// No previous content — remove the asset
					await shopifyClient.deleteAsset(mainTheme.id, rollbackData.assetKey);
					log.info("Shopify rollback: deleted asset", {
						themeId: mainTheme.id,
						assetKey: rollbackData.assetKey,
					});
				}
				break;
			}
		}

		// 5. Mark rolled_back
		await fixQueries.updateDeploymentStatus(db, deploymentAttemptId, {
			status: "rolled_back",
			completedAt: new Date(),
		});

		log.info("Rollback succeeded", { deploymentAttemptId });
		return { deploymentAttemptId, rolledBack: true };
	} catch (err) {
		// Mark failed on rollback error
		await fixQueries.updateDeploymentStatus(db, deploymentAttemptId, {
			status: "failed",
			errorMessage: err instanceof Error ? err.message : String(err),
			errorCode: "ROLLBACK_FAILED",
			completedAt: new Date(),
		});
		throw err;
	}
}
