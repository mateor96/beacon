/**
 * Deploy processor (#280, #284).
 *
 * Deploys a generated fix to the user's CMS (WordPress, Webflow).
 * Flow: fetch fix -> decrypt CMS creds -> transition pending->in_progress ->
 * CMS-specific deploy -> mark succeeded with rollbackData -> mark fix as "deployed".
 */

import type { DeployJobData, DeployJobResult } from "@beacon/queue";
import type { CmsCredentialsPlaintext, RollbackPayload } from "@beacon/shared";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";
import { ShopifyApiError, ShopifyClient } from "../lib/shopify-client.js";
import { WebflowApiError, WebflowClient, type WfCustomCodeScript } from "../lib/webflow-client.js";
import { WordPressApiError, WordPressClient, type WpPage } from "../lib/wordpress-client.js";

/** Map DB fix_type to WP page slug. */
function fixTypeToSlug(fixType: string): string {
	switch (fixType) {
		case "llms_txt":
			return "llms-txt";
		case "json_ld":
			return "schema-jsonld";
		case "agents_md":
			return "agents-md";
		default:
			return fixType;
	}
}

/** Wrap fix content for WordPress depending on fix type. */
function wrapContent(fixType: string, rawContent: string): string {
	switch (fixType) {
		case "llms_txt":
		case "agents_md":
			return `<pre>${rawContent}</pre>`;
		case "json_ld":
			return `<script type="application/ld+json">${rawContent}</script>`;
		default:
			return rawContent;
	}
}

/** Map a human-readable title from fix type. */
function fixTypeToTitle(fixType: string): string {
	switch (fixType) {
		case "llms_txt":
			return "llms.txt";
		case "json_ld":
			return "Schema JSON-LD";
		case "agents_md":
			return "agents.md";
		default:
			return fixType;
	}
}

/** Map WordPressApiError codes to deployment error codes. */
function mapWpErrorCode(err: unknown): string {
	if (err instanceof WordPressApiError) {
		switch (err.code) {
			case "AUTH_FAILED":
				return "AUTH";
			case "PERMISSION_DENIED":
				return "AUTH";
			case "TIMEOUT":
				return "NETWORK";
			case "NETWORK":
				return "NETWORK";
			case "RATE_LIMITED":
				return "CMS_4XX";
			case "NOT_FOUND":
				return "CMS_4XX";
			case "CMS_ERROR":
				return "CMS_5XX";
			default:
				return "UNKNOWN";
		}
	}
	return "UNKNOWN";
}

/** Map WebflowApiError codes to deployment error codes. */
function mapWfErrorCode(err: unknown): string {
	if (err instanceof WebflowApiError) {
		switch (err.code) {
			case "AUTH_FAILED":
				return "AUTH";
			case "PERMISSION_DENIED":
				return "AUTH";
			case "TIMEOUT":
				return "NETWORK";
			case "NETWORK":
				return "NETWORK";
			case "RATE_LIMITED":
				return "CMS_4XX";
			case "NOT_FOUND":
				return "CMS_4XX";
			case "CMS_ERROR":
				return "CMS_5XX";
			default:
				return "UNKNOWN";
		}
	}
	return "UNKNOWN";
}

/** Map ShopifyApiError codes to deployment error codes. */
function mapShopifyErrorCode(err: unknown): string {
	if (err instanceof ShopifyApiError) {
		switch (err.code) {
			case "AUTH_FAILED":
				return "AUTH";
			case "PERMISSION_DENIED":
				return "AUTH";
			case "TIMEOUT":
				return "NETWORK";
			case "NETWORK":
				return "NETWORK";
			case "RATE_LIMITED":
				return "CMS_4XX";
			case "NOT_FOUND":
				return "CMS_4XX";
			case "CMS_ERROR":
				return "CMS_5XX";
			default:
				return "UNKNOWN";
		}
	}
	return "UNKNOWN";
}

/** Map any CMS error to deployment error code based on credentials type. */
function mapCmsErrorCode(cms: string, err: unknown): string {
	switch (cms) {
		case "wordpress":
			return mapWpErrorCode(err);
		case "webflow":
			return mapWfErrorCode(err);
		case "shopify":
			return mapShopifyErrorCode(err);
		default:
			return "UNKNOWN";
	}
}

export async function processDeploy(
	job: Job<DeployJobData, DeployJobResult>,
): Promise<DeployJobResult> {
	const { fixId, cmsConnectionId, deploymentAttemptId } = job.data;
	const log = createJobLogger({
		queue: "deploy",
		jobId: job.id ?? "unknown",
		scanId: deploymentAttemptId,
		correlationId: deploymentAttemptId,
	});

	log.info("Processing deployment", { fixId, cmsConnectionId, deploymentAttemptId });

	const { db, fixQueries } = await import("@beacon/db");
	const { assertValidDeploymentTransition } = await import("@beacon/shared");

	// 1. Fetch fix
	const fix = await fixQueries.getFixById(db, fixId);
	if (!fix) {
		throw new Error(`Fix ${fixId} not found`);
	}

	// 2. Decrypt CMS credentials
	const { connection, credentials } = await fixQueries.getDecryptedCmsConnection(
		db,
		cmsConnectionId,
	);

	// 3. Fetch deployment attempt and transition pending -> in_progress
	const attempt = await fixQueries.getDeploymentAttemptById(db, deploymentAttemptId);
	if (!attempt) {
		throw new Error(`Deployment attempt ${deploymentAttemptId} not found`);
	}
	assertValidDeploymentTransition(attempt.status as "pending", "in_progress");
	await fixQueries.updateDeploymentStatus(db, deploymentAttemptId, {
		status: "in_progress",
	});

	try {
		let rollbackData: RollbackPayload;

		switch (credentials.cms) {
			case "wordpress": {
				rollbackData = await deployToWordPress(credentials, fix, log);
				break;
			}
			case "webflow": {
				// Webflow only supports JSON-LD injection via custom code
				if (fix.fixType !== "json_ld") {
					await fixQueries.updateDeploymentStatus(db, deploymentAttemptId, {
						status: "failed",
						errorMessage: "Webflow unterstuetzt keine Datei-Deployments. Nur JSON-LD ist moeglich.",
						errorCode: "UNSUPPORTED_FIX_TYPE",
						completedAt: new Date(),
					});
					throw new Error(
						"Webflow unterstuetzt keine Datei-Deployments. Nur JSON-LD ist moeglich.",
					);
				}
				rollbackData = await deployToWebflow(credentials, fix, log);
				break;
			}
			case "shopify": {
				rollbackData = await deployToShopify(credentials, fix, log);
				break;
			}
			default:
				throw new Error(`Unsupported CMS type: ${(credentials as CmsCredentialsPlaintext).cms}`);
		}

		// Mark succeeded with rollback data
		await fixQueries.updateDeploymentStatus(db, deploymentAttemptId, {
			status: "succeeded",
			rollbackData,
			completedAt: new Date(),
		});

		// Mark fix as deployed
		await fixQueries.markFixStatus(db, fixId, "deployed");

		// Touch CMS connection last used
		await fixQueries.touchCmsConnectionLastUsed(db, cmsConnectionId);

		log.info("Deployment succeeded", { deploymentAttemptId, cms: credentials.cms });

		// Enqueue post-deployment validation (2 min delay for CDN propagation)
		try {
			const { addJob } = await import("@beacon/queue");
			await addJob(
				"validate-deployment",
				{
					deploymentAttemptId,
					fixId,
					fixType: fix.fixType,
					expectedContent: fix.content,
					siteUrl: connection.siteUrl,
				},
				{ delay: 120_000 },
			);
			log.info("Validation job enqueued", { deploymentAttemptId });
		} catch (valErr) {
			// Validation enqueue failure must NOT fail the deployment
			log.error("Failed to enqueue validation job", {
				deploymentAttemptId,
				error: valErr instanceof Error ? valErr.message : String(valErr),
			});
		}

		return { deploymentAttemptId, deployed: true, rollbackData };
	} catch (err) {
		const errorCode = mapCmsErrorCode(credentials.cms, err);
		const errorMessage = err instanceof Error ? err.message : String(err);

		await fixQueries.updateDeploymentStatus(db, deploymentAttemptId, {
			status: "failed",
			errorMessage,
			errorCode,
			completedAt: new Date(),
		});

		// Re-throw so BullMQ can retry
		throw err;
	}
}

// ── WordPress deploy ────────────────────────────────────────

async function deployToWordPress(
	credentials: Extract<CmsCredentialsPlaintext, { cms: "wordpress" }>,
	fix: { fixType: string; content: string },
	log: ReturnType<typeof createJobLogger>,
): Promise<RollbackPayload> {
	const client = new WordPressClient({
		baseUrl: credentials.baseUrl,
		username: credentials.username,
		appPassword: credentials.appPassword,
	});

	const slug = fixTypeToSlug(fix.fixType);
	const wrappedContent = wrapContent(fix.fixType, fix.content);

	// Backup existing state
	let existingPage: WpPage | null = null;
	try {
		existingPage = await client.getPageBySlug(slug);
	} catch (err) {
		if (!(err instanceof WordPressApiError && err.code === "NOT_FOUND")) {
			throw err;
		}
	}

	// Deploy content
	let deployedPage: WpPage;
	if (existingPage) {
		deployedPage = await client.updatePage(existingPage.id, { content: wrappedContent });
	} else {
		deployedPage = await client.createPage({
			slug,
			title: fixTypeToTitle(fix.fixType),
			content: wrappedContent,
			status: "publish",
		});
	}

	log.info("WordPress deployment completed", {
		pageId: deployedPage.id,
		strategy: existingPage ? "update" : "create",
	});

	return existingPage
		? {
				cms: "wordpress",
				strategy: "restore_field",
				postId: existingPage.id,
				previousContent: existingPage.content.rendered,
				capturedAt: new Date().toISOString(),
			}
		: {
				cms: "wordpress",
				strategy: "delete_file",
				postId: deployedPage.id,
				capturedAt: new Date().toISOString(),
			};
}

// ── Webflow deploy ──────────────────────────────────────────

async function deployToWebflow(
	credentials: Extract<CmsCredentialsPlaintext, { cms: "webflow" }>,
	fix: { fixType: string; content: string },
	log: ReturnType<typeof createJobLogger>,
): Promise<RollbackPayload> {
	const client = new WebflowClient({
		siteId: credentials.siteId,
		apiToken: credentials.apiToken,
	});

	// 1. Backup: capture existing custom code scripts
	const existing = await client.getCustomCode();
	const previousScripts = existing.scripts ?? [];

	// 2. Build new scripts array with Beacon JSON-LD appended
	const awrScript: WfCustomCodeScript = {
		displayName: "Beacon JSON-LD",
		location: "header",
		version: "1.0.0",
		sourceCode: `<script type="application/ld+json">${fix.content}</script>`,
	};

	// Replace existing Beacon script if present, otherwise append
	const filteredScripts = previousScripts.filter((s) => s.displayName !== "Beacon JSON-LD");
	const newScripts = [...filteredScripts, awrScript];

	// 3. Deploy custom code
	await client.upsertCustomCode(newScripts);

	// 4. Publish site
	await client.publishSite();

	log.info("Webflow deployment completed", {
		siteId: credentials.siteId,
		scriptsCount: newScripts.length,
	});

	// 5. Build rollback payload using existing Webflow variant fields
	return {
		cms: "webflow",
		strategy: "restore_field",
		collectionId: credentials.siteId,
		itemId: "custom_code",
		previousFields: { scripts: previousScripts },
		capturedAt: new Date().toISOString(),
	};
}

// ── Shopify deploy ─────────────────────────────────────────

/** Map fix type to Shopify theme asset key. */
function fixTypeToAssetKey(fixType: string): string {
	switch (fixType) {
		case "llms_txt":
			return "assets/llms.txt";
		case "agents_md":
			return "assets/agents.md";
		case "json_ld":
			return "snippets/beacon-schema.liquid";
		default:
			return `assets/${fixType}`;
	}
}

/** Wrap content for Shopify depending on fix type. */
function wrapShopifyContent(fixType: string, rawContent: string): string {
	if (fixType === "json_ld") {
		return `<script type="application/ld+json">${rawContent}</script>`;
	}
	return rawContent;
}

async function deployToShopify(
	credentials: Extract<CmsCredentialsPlaintext, { cms: "shopify" }>,
	fix: { fixType: string; content: string },
	log: ReturnType<typeof createJobLogger>,
): Promise<RollbackPayload> {
	const client = new ShopifyClient({
		shopDomain: credentials.shopDomain,
		accessToken: credentials.accessToken,
		apiVersion: credentials.apiVersion,
	});

	// 1. Get main theme
	const themes = await client.getThemes();
	const mainTheme = themes.find((t) => t.role === "main");
	if (!mainTheme) {
		throw new ShopifyApiError(
			"NOT_FOUND",
			"Kein aktives Theme gefunden. Bitte stellen Sie sicher, dass ein Theme veroeffentlicht ist.",
		);
	}

	const assetKey = fixTypeToAssetKey(fix.fixType);
	const deployContent = wrapShopifyContent(fix.fixType, fix.content);

	// 2. Backup: capture existing asset (if any)
	let previousValue = "";
	const existingAsset = await client.getAsset(mainTheme.id, assetKey);
	if (existingAsset?.value) {
		previousValue = existingAsset.value;
	}

	// 3. Deploy: create or update theme asset (live immediately)
	await client.putAsset(mainTheme.id, assetKey, deployContent);

	log.info("Shopify deployment completed", {
		themeId: mainTheme.id,
		assetKey,
		hadPrevious: !!previousValue,
	});

	// 4. Build rollback payload
	return {
		cms: "shopify",
		strategy: "restore_theme_asset",
		themeId: mainTheme.id,
		assetKey,
		previousValue,
		capturedAt: new Date().toISOString(),
	};
}
