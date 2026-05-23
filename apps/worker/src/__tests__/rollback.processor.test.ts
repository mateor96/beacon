import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────

const {
	mockGetDeploymentAttemptById,
	mockUpdateDeploymentStatus,
	mockGetDecryptedCmsConnection,
	mockAssertValidDeploymentTransition,
} = vi.hoisted(() => ({
	mockGetDeploymentAttemptById: vi.fn(),
	mockUpdateDeploymentStatus: vi.fn(),
	mockGetDecryptedCmsConnection: vi.fn(),
	mockAssertValidDeploymentTransition: vi.fn(),
}));

vi.mock("@beacon/db", () => ({
	db: {},
	fixQueries: {
		getDeploymentAttemptById: (...args: unknown[]) => mockGetDeploymentAttemptById(...args),
		updateDeploymentStatus: (...args: unknown[]) => mockUpdateDeploymentStatus(...args),
		getDecryptedCmsConnection: (...args: unknown[]) => mockGetDecryptedCmsConnection(...args),
	},
}));

vi.mock("@beacon/shared", () => ({
	assertValidDeploymentTransition: (...args: unknown[]) =>
		mockAssertValidDeploymentTransition(...args),
}));

// ── CMS client mocks ──────────────────────────────────────────

const mockWpUpdatePage = vi.fn();
const mockWpDeletePage = vi.fn();

vi.mock("../lib/wordpress-client.js", () => ({
	WordPressClient: vi.fn().mockImplementation(() => ({
		updatePage: mockWpUpdatePage,
		deletePage: mockWpDeletePage,
	})),
}));

const mockWfUpsertCustomCode = vi.fn();
const mockWfPublishSite = vi.fn();

vi.mock("../lib/webflow-client.js", () => ({
	WebflowClient: vi.fn().mockImplementation(() => ({
		upsertCustomCode: mockWfUpsertCustomCode,
		publishSite: mockWfPublishSite,
	})),
}));

const mockShopifyGetThemes = vi.fn();
const mockShopifyPutAsset = vi.fn();
const mockShopifyDeleteAsset = vi.fn();

vi.mock("../lib/shopify-client.js", () => ({
	ShopifyClient: vi.fn().mockImplementation(() => ({
		getThemes: mockShopifyGetThemes,
		putAsset: mockShopifyPutAsset,
		deleteAsset: mockShopifyDeleteAsset,
	})),
}));

import { processRollback } from "../processors/rollback.processor.js";

// ── Helpers ──────────────────────────────────────────────────

function makeJob(overrides: Partial<Parameters<typeof processRollback>[0]["data"]> = {}) {
	const data = {
		deploymentAttemptId: "dep-1",
		triggeredBy: "user-1",
		...overrides,
	};
	return {
		id: "test-job-1",
		data,
		opts: { attempts: 3 },
		attemptsMade: 0,
		updateProgress: vi.fn(),
		log: vi.fn(),
	} as Parameters<typeof processRollback>[0];
}

function wpCreds() {
	return {
		connection: { siteUrl: "https://example.com" },
		credentials: {
			cms: "wordpress" as const,
			baseUrl: "https://example.com",
			username: "admin",
			appPassword: "xxxx",
		},
	};
}

function wfCreds() {
	return {
		connection: { siteUrl: "https://example.webflow.io" },
		credentials: {
			cms: "webflow" as const,
			siteId: "site_abc",
			apiToken: "wf_token",
		},
	};
}

function shopifyCreds() {
	return {
		connection: { siteUrl: "https://test.myshopify.com" },
		credentials: {
			cms: "shopify" as const,
			shopDomain: "test.myshopify.com",
			accessToken: "shpat_123",
			apiVersion: "2024-01",
		},
	};
}

// ── Tests ────────────────────────────────────────────────────

describe("processRollback", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockAssertValidDeploymentTransition.mockReturnValue(undefined);
		mockUpdateDeploymentStatus.mockResolvedValue(undefined);
	});

	// ── WordPress ────────────────────────────────────────────

	describe("WordPress", () => {
		it("restore_field: updatePage called with previousContent", async () => {
			mockGetDeploymentAttemptById.mockResolvedValue({
				id: "dep-1",
				status: "succeeded",
				cmsConnectionId: "conn-1",
				rollbackData: {
					cms: "wordpress",
					strategy: "restore_field",
					postId: 42,
					previousContent: "<pre>old content</pre>",
					capturedAt: "2025-01-01T00:00:00.000Z",
				},
			});
			mockGetDecryptedCmsConnection.mockResolvedValue(wpCreds());
			mockWpUpdatePage.mockResolvedValue({});

			const result = await processRollback(makeJob());

			expect(result.rolledBack).toBe(true);
			expect(mockWpUpdatePage).toHaveBeenCalledWith(42, {
				content: "<pre>old content</pre>",
			});
			expect(mockUpdateDeploymentStatus).toHaveBeenCalledWith(
				expect.anything(),
				"dep-1",
				expect.objectContaining({ status: "rolled_back" }),
			);
		});

		it("delete_file: deletePage called", async () => {
			mockGetDeploymentAttemptById.mockResolvedValue({
				id: "dep-1",
				status: "succeeded",
				cmsConnectionId: "conn-1",
				rollbackData: {
					cms: "wordpress",
					strategy: "delete_file",
					postId: 42,
					capturedAt: "2025-01-01T00:00:00.000Z",
				},
			});
			mockGetDecryptedCmsConnection.mockResolvedValue(wpCreds());
			mockWpDeletePage.mockResolvedValue(undefined);

			const result = await processRollback(makeJob());

			expect(result.rolledBack).toBe(true);
			expect(mockWpDeletePage).toHaveBeenCalledWith(42);
		});
	});

	// ── Webflow ──────────────────────────────────────────────

	describe("Webflow", () => {
		it("restores previous custom code and publishes", async () => {
			const previousScripts = [
				{
					displayName: "Analytics",
					location: "header",
					version: "1.0.0",
					sourceCode: "<script></script>",
				},
			];
			mockGetDeploymentAttemptById.mockResolvedValue({
				id: "dep-1",
				status: "succeeded",
				cmsConnectionId: "conn-1",
				rollbackData: {
					cms: "webflow",
					strategy: "restore_field",
					collectionId: "site_abc",
					itemId: "custom_code",
					previousFields: { scripts: previousScripts },
					capturedAt: "2025-01-01T00:00:00.000Z",
				},
			});
			mockGetDecryptedCmsConnection.mockResolvedValue(wfCreds());
			mockWfUpsertCustomCode.mockResolvedValue({});
			mockWfPublishSite.mockResolvedValue(undefined);

			const result = await processRollback(makeJob());

			expect(result.rolledBack).toBe(true);
			expect(mockWfUpsertCustomCode).toHaveBeenCalledWith(previousScripts);
			expect(mockWfPublishSite).toHaveBeenCalled();
		});
	});

	// ── Shopify ──────────────────────────────────────────────

	describe("Shopify", () => {
		beforeEach(() => {
			mockShopifyGetThemes.mockResolvedValue([{ id: 1001, name: "Dawn", role: "main" }]);
		});

		it("restores previous asset value", async () => {
			mockGetDeploymentAttemptById.mockResolvedValue({
				id: "dep-1",
				status: "succeeded",
				cmsConnectionId: "conn-1",
				rollbackData: {
					cms: "shopify",
					strategy: "restore_theme_asset",
					themeId: 1001,
					assetKey: "assets/llms.txt",
					previousValue: "# Old content",
					capturedAt: "2025-01-01T00:00:00.000Z",
				},
			});
			mockGetDecryptedCmsConnection.mockResolvedValue(shopifyCreds());
			mockShopifyPutAsset.mockResolvedValue({});

			const result = await processRollback(makeJob());

			expect(result.rolledBack).toBe(true);
			expect(mockShopifyPutAsset).toHaveBeenCalledWith(1001, "assets/llms.txt", "# Old content");
		});

		it("deletes asset when no previous value", async () => {
			mockGetDeploymentAttemptById.mockResolvedValue({
				id: "dep-1",
				status: "succeeded",
				cmsConnectionId: "conn-1",
				rollbackData: {
					cms: "shopify",
					strategy: "restore_theme_asset",
					themeId: 1001,
					assetKey: "assets/llms.txt",
					previousValue: "",
					capturedAt: "2025-01-01T00:00:00.000Z",
				},
			});
			mockGetDecryptedCmsConnection.mockResolvedValue(shopifyCreds());
			mockShopifyDeleteAsset.mockResolvedValue(undefined);

			const result = await processRollback(makeJob());

			expect(result.rolledBack).toBe(true);
			expect(mockShopifyDeleteAsset).toHaveBeenCalledWith(1001, "assets/llms.txt");
		});
	});

	// ── Error paths ──────────────────────────────────────────

	describe("error handling", () => {
		it("deployment not found throws", async () => {
			mockGetDeploymentAttemptById.mockResolvedValue(null);

			await expect(processRollback(makeJob())).rejects.toThrow("Deployment dep-1 not found");
		});

		it("no rollback data throws", async () => {
			mockGetDeploymentAttemptById.mockResolvedValue({
				id: "dep-1",
				status: "succeeded",
				cmsConnectionId: "conn-1",
				rollbackData: null,
			});

			await expect(processRollback(makeJob())).rejects.toThrow(
				"No rollback data for deployment dep-1",
			);
		});
	});
});
