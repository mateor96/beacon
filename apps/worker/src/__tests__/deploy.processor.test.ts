import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────

const {
	mockGetFixById,
	mockGetDecryptedCmsConnection,
	mockGetDeploymentAttemptById,
	mockUpdateDeploymentStatus,
	mockMarkFixStatus,
	mockTouchCmsConnectionLastUsed,
	mockAssertValidDeploymentTransition,
	mockAddJob,
} = vi.hoisted(() => ({
	mockGetFixById: vi.fn(),
	mockGetDecryptedCmsConnection: vi.fn(),
	mockGetDeploymentAttemptById: vi.fn(),
	mockUpdateDeploymentStatus: vi.fn(),
	mockMarkFixStatus: vi.fn(),
	mockTouchCmsConnectionLastUsed: vi.fn(),
	mockAssertValidDeploymentTransition: vi.fn(),
	mockAddJob: vi.fn(),
}));

vi.mock("@beacon/db", () => ({
	db: {},
	fixQueries: {
		getFixById: (...args: unknown[]) => mockGetFixById(...args),
		getDecryptedCmsConnection: (...args: unknown[]) => mockGetDecryptedCmsConnection(...args),
		getDeploymentAttemptById: (...args: unknown[]) => mockGetDeploymentAttemptById(...args),
		updateDeploymentStatus: (...args: unknown[]) => mockUpdateDeploymentStatus(...args),
		markFixStatus: (...args: unknown[]) => mockMarkFixStatus(...args),
		touchCmsConnectionLastUsed: (...args: unknown[]) => mockTouchCmsConnectionLastUsed(...args),
	},
}));

vi.mock("@beacon/shared", () => ({
	assertValidDeploymentTransition: (...args: unknown[]) =>
		mockAssertValidDeploymentTransition(...args),
}));

vi.mock("@beacon/queue", () => ({
	addJob: (...args: unknown[]) => mockAddJob(...args),
}));

// ── CMS client mocks ──────────────────────────────────────────

const mockWpGetPageBySlug = vi.fn();
const mockWpCreatePage = vi.fn();
const mockWpUpdatePage = vi.fn();

vi.mock("../lib/wordpress-client.js", () => ({
	WordPressApiError: class WordPressApiError extends Error {
		code: string;
		statusCode?: number;
		constructor(code: string, message: string, statusCode?: number) {
			super(message);
			this.name = "WordPressApiError";
			this.code = code;
			this.statusCode = statusCode;
		}
	},
	WordPressClient: vi.fn().mockImplementation(() => ({
		getPageBySlug: mockWpGetPageBySlug,
		createPage: mockWpCreatePage,
		updatePage: mockWpUpdatePage,
	})),
}));

const mockWfGetCustomCode = vi.fn();
const mockWfUpsertCustomCode = vi.fn();
const mockWfPublishSite = vi.fn();

vi.mock("../lib/webflow-client.js", () => ({
	WebflowApiError: class WebflowApiError extends Error {
		code: string;
		statusCode?: number;
		constructor(code: string, message: string, statusCode?: number) {
			super(message);
			this.name = "WebflowApiError";
			this.code = code;
			this.statusCode = statusCode;
		}
	},
	WebflowClient: vi.fn().mockImplementation(() => ({
		getCustomCode: mockWfGetCustomCode,
		upsertCustomCode: mockWfUpsertCustomCode,
		publishSite: mockWfPublishSite,
	})),
}));

const mockShopifyGetThemes = vi.fn();
const mockShopifyGetAsset = vi.fn();
const mockShopifyPutAsset = vi.fn();

vi.mock("../lib/shopify-client.js", () => ({
	ShopifyApiError: class ShopifyApiError extends Error {
		code: string;
		statusCode?: number;
		constructor(code: string, message: string, statusCode?: number) {
			super(message);
			this.name = "ShopifyApiError";
			this.code = code;
			this.statusCode = statusCode;
		}
	},
	ShopifyClient: vi.fn().mockImplementation(() => ({
		getThemes: mockShopifyGetThemes,
		getAsset: mockShopifyGetAsset,
		putAsset: mockShopifyPutAsset,
	})),
}));

import { processDeploy } from "../processors/deploy.processor.js";

// ── Helpers ──────────────────────────────────────────────────

function makeJob(overrides: Partial<Parameters<typeof processDeploy>[0]["data"]> = {}) {
	const data = {
		fixId: "fix-1",
		cmsConnectionId: "conn-1",
		deploymentAttemptId: "dep-1",
		...overrides,
	};
	return {
		id: "test-job-1",
		data,
		opts: { attempts: 3 },
		attemptsMade: 0,
		updateProgress: vi.fn(),
		log: vi.fn(),
	} as Parameters<typeof processDeploy>[0];
}

function wpCredentials() {
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

function wfCredentials() {
	return {
		connection: { siteUrl: "https://example.webflow.io" },
		credentials: {
			cms: "webflow" as const,
			siteId: "site_abc",
			apiToken: "wf_token",
		},
	};
}

function shopifyCredentials() {
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

const baseFix = {
	fixType: "llms_txt",
	content: "# LLMs.txt content",
};

const baseAttempt = {
	id: "dep-1",
	status: "pending",
	cmsConnectionId: "conn-1",
};

// ── Tests ────────────────────────────────────────────────────

describe("processDeploy", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetDeploymentAttemptById.mockResolvedValue(baseAttempt);
		mockUpdateDeploymentStatus.mockResolvedValue(undefined);
		mockMarkFixStatus.mockResolvedValue(undefined);
		mockTouchCmsConnectionLastUsed.mockResolvedValue(undefined);
		mockAssertValidDeploymentTransition.mockReturnValue(undefined);
		mockAddJob.mockResolvedValue(undefined);
	});

	// ── WordPress ────────────────────────────────────────────

	describe("WordPress", () => {
		it("creates page when none exists, status succeeded, rollback strategy delete_file", async () => {
			mockGetFixById.mockResolvedValue(baseFix);
			mockGetDecryptedCmsConnection.mockResolvedValue(wpCredentials());
			mockWpGetPageBySlug.mockResolvedValue(null);
			mockWpCreatePage.mockResolvedValue({
				id: 42,
				slug: "llms-txt",
				title: { rendered: "llms.txt" },
				content: { rendered: "<pre># LLMs.txt content</pre>" },
				status: "publish",
				link: "https://example.com/llms-txt/",
			});

			const result = await processDeploy(makeJob());

			expect(result.deployed).toBe(true);
			expect(result.rollbackData).toMatchObject({
				cms: "wordpress",
				strategy: "delete_file",
				postId: 42,
			});
			expect(mockWpCreatePage).toHaveBeenCalledWith(
				expect.objectContaining({
					slug: "llms-txt",
					title: "llms.txt",
					content: "<pre># LLMs.txt content</pre>",
					status: "publish",
				}),
			);
			expect(mockUpdateDeploymentStatus).toHaveBeenCalledWith(
				expect.anything(),
				"dep-1",
				expect.objectContaining({ status: "succeeded" }),
			);
		});

		it("updates existing page, rollback has restore_field + previousContent", async () => {
			mockGetFixById.mockResolvedValue(baseFix);
			mockGetDecryptedCmsConnection.mockResolvedValue(wpCredentials());
			const existingPage = {
				id: 99,
				slug: "llms-txt",
				title: { rendered: "llms.txt" },
				content: { rendered: "<pre>old content</pre>" },
				status: "publish",
				link: "https://example.com/llms-txt/",
			};
			mockWpGetPageBySlug.mockResolvedValue(existingPage);
			mockWpUpdatePage.mockResolvedValue({
				...existingPage,
				content: { rendered: "<pre># LLMs.txt content</pre>" },
			});

			const result = await processDeploy(makeJob());

			expect(result.deployed).toBe(true);
			expect(result.rollbackData).toMatchObject({
				cms: "wordpress",
				strategy: "restore_field",
				postId: 99,
				previousContent: "<pre>old content</pre>",
			});
			expect(mockWpUpdatePage).toHaveBeenCalledWith(99, {
				content: "<pre># LLMs.txt content</pre>",
			});
		});
	});

	// ── Webflow ──────────────────────────────────────────────

	describe("Webflow", () => {
		it("injects JSON-LD, calls publishSite, rollback has previousFields", async () => {
			const jsonLdFix = { fixType: "json_ld", content: '{"@context":"https://schema.org"}' };
			mockGetFixById.mockResolvedValue(jsonLdFix);
			mockGetDecryptedCmsConnection.mockResolvedValue(wfCredentials());
			mockWfGetCustomCode.mockResolvedValue({ scripts: [] });
			mockWfUpsertCustomCode.mockResolvedValue({ scripts: [] });
			mockWfPublishSite.mockResolvedValue(undefined);

			const result = await processDeploy(makeJob());

			expect(result.deployed).toBe(true);
			expect(result.rollbackData).toMatchObject({
				cms: "webflow",
				strategy: "restore_field",
				previousFields: { scripts: [] },
			});
			expect(mockWfUpsertCustomCode).toHaveBeenCalledWith(
				expect.arrayContaining([expect.objectContaining({ displayName: "Beacon JSON-LD" })]),
			);
			expect(mockWfPublishSite).toHaveBeenCalled();
		});

		it("rejects llms_txt with UNSUPPORTED_FIX_TYPE", async () => {
			mockGetFixById.mockResolvedValue(baseFix); // llms_txt
			mockGetDecryptedCmsConnection.mockResolvedValue(wfCredentials());

			await expect(processDeploy(makeJob())).rejects.toThrow(
				"Webflow unterstuetzt keine Datei-Deployments",
			);
			expect(mockUpdateDeploymentStatus).toHaveBeenCalledWith(
				expect.anything(),
				"dep-1",
				expect.objectContaining({
					status: "failed",
					errorCode: "UNSUPPORTED_FIX_TYPE",
				}),
			);
		});
	});

	// ── Shopify ──────────────────────────────────────────────

	describe("Shopify", () => {
		it("puts asset to main theme with correct asset key mapping", async () => {
			mockGetFixById.mockResolvedValue(baseFix);
			mockGetDecryptedCmsConnection.mockResolvedValue(shopifyCredentials());
			mockShopifyGetThemes.mockResolvedValue([{ id: 1001, name: "Dawn", role: "main" }]);
			mockShopifyGetAsset.mockResolvedValue(null);
			mockShopifyPutAsset.mockResolvedValue({
				key: "assets/llms.txt",
				value: "# LLMs.txt content",
				theme_id: 1001,
			});

			const result = await processDeploy(makeJob());

			expect(result.deployed).toBe(true);
			expect(mockShopifyPutAsset).toHaveBeenCalledWith(
				1001,
				"assets/llms.txt",
				"# LLMs.txt content",
			);
			expect(result.rollbackData).toMatchObject({
				cms: "shopify",
				strategy: "restore_theme_asset",
				themeId: 1001,
				assetKey: "assets/llms.txt",
				previousValue: "",
			});
		});
	});

	// ── Error paths ──────────────────────────────────────────

	describe("error handling", () => {
		it("fix not found throws", async () => {
			mockGetFixById.mockResolvedValue(null);

			await expect(processDeploy(makeJob())).rejects.toThrow("Fix fix-1 not found");
		});

		it("CMS API error marks failed and re-throws for retry", async () => {
			mockGetFixById.mockResolvedValue(baseFix);
			mockGetDecryptedCmsConnection.mockResolvedValue(wpCredentials());
			mockWpGetPageBySlug.mockRejectedValue(new Error("Connection refused"));

			await expect(processDeploy(makeJob())).rejects.toThrow("Connection refused");
			expect(mockUpdateDeploymentStatus).toHaveBeenCalledWith(
				expect.anything(),
				"dep-1",
				expect.objectContaining({
					status: "failed",
					errorMessage: "Connection refused",
				}),
			);
		});

		it("validation job enqueue failure does not fail deployment", async () => {
			mockGetFixById.mockResolvedValue(baseFix);
			mockGetDecryptedCmsConnection.mockResolvedValue(wpCredentials());
			mockWpGetPageBySlug.mockResolvedValue(null);
			mockWpCreatePage.mockResolvedValue({
				id: 42,
				slug: "llms-txt",
				title: { rendered: "llms.txt" },
				content: { rendered: "<pre># LLMs.txt content</pre>" },
				status: "publish",
				link: "https://example.com/llms-txt/",
			});
			mockAddJob.mockRejectedValue(new Error("Redis down"));

			const result = await processDeploy(makeJob());

			// Deployment still succeeds despite validation enqueue failure
			expect(result.deployed).toBe(true);
			expect(mockUpdateDeploymentStatus).toHaveBeenCalledWith(
				expect.anything(),
				"dep-1",
				expect.objectContaining({ status: "succeeded" }),
			);
		});
	});
});
