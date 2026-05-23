import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShopifyApiError, ShopifyClient, type ShopifyClientConfig } from "../lib/shopify-client.js";

const BASE_CONFIG: ShopifyClientConfig = {
	shopDomain: "test-shop.myshopify.com",
	accessToken: "shpat_abc123",
	apiVersion: "2024-01",
};

describe("ShopifyClient", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("sends X-Shopify-Access-Token header on every request", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ themes: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const client = new ShopifyClient(BASE_CONFIG);
		await client.getThemes();

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		const authHeader = (init.headers as Record<string, string>)["X-Shopify-Access-Token"];
		expect(authHeader).toBe("shpat_abc123");
	});

	it("getThemes calls correct endpoint and returns themes array", async () => {
		const mockThemes = [
			{ id: 1001, name: "Dawn", role: "main", created_at: "2024-01-01", updated_at: "2024-01-01" },
			{
				id: 1002,
				name: "Draft",
				role: "unpublished",
				created_at: "2024-01-01",
				updated_at: "2024-01-01",
			},
		];
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ themes: mockThemes }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const client = new ShopifyClient(BASE_CONFIG);
		const themes = await client.getThemes();

		expect(themes).toHaveLength(2);
		expect(themes[0].role).toBe("main");

		const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://test-shop.myshopify.com/admin/api/2024-01/themes.json");
		expect(init.method).toBe("GET");
	});

	it("putAsset sends PUT with asset body", async () => {
		const mockAsset = {
			key: "assets/llms.txt",
			value: "# LLMs.txt content",
			theme_id: 1001,
			created_at: "2024-01-01",
			updated_at: "2024-01-01",
		};
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ asset: mockAsset }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const client = new ShopifyClient(BASE_CONFIG);
		const result = await client.putAsset(1001, "assets/llms.txt", "# LLMs.txt content");

		expect(result.key).toBe("assets/llms.txt");

		const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://test-shop.myshopify.com/admin/api/2024-01/themes/1001/assets.json");
		expect(init.method).toBe("PUT");

		const body = JSON.parse(init.body as string);
		expect(body.asset.key).toBe("assets/llms.txt");
		expect(body.asset.value).toBe("# LLMs.txt content");
	});

	it("getAsset returns null for 404", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ errors: "Not Found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const client = new ShopifyClient(BASE_CONFIG);
		const result = await client.getAsset(1001, "assets/nonexistent.txt");

		expect(result).toBeNull();
	});

	it("deleteAsset sends DELETE with asset key in query", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({}), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const client = new ShopifyClient(BASE_CONFIG);
		await client.deleteAsset(1001, "assets/llms.txt");

		const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toContain("/themes/1001/assets.json?asset[key]=");
		expect(url).toContain("assets%2Fllms.txt");
		expect(init.method).toBe("DELETE");
	});

	it("maps fetch timeout to TIMEOUT error", async () => {
		const timeoutError = new Error("timeout");
		timeoutError.name = "TimeoutError";
		fetchSpy.mockRejectedValueOnce(timeoutError);

		const client = new ShopifyClient(BASE_CONFIG);

		try {
			await client.getThemes();
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ShopifyApiError);
			expect((err as ShopifyApiError).code).toBe("TIMEOUT");
		}
	});

	it("maps HTTP status codes to typed errors", async () => {
		const cases: Array<{ status: number; expectedCode: string }> = [
			{ status: 401, expectedCode: "AUTH_FAILED" },
			{ status: 403, expectedCode: "PERMISSION_DENIED" },
			{ status: 429, expectedCode: "RATE_LIMITED" },
			{ status: 500, expectedCode: "CMS_ERROR" },
		];

		const client = new ShopifyClient(BASE_CONFIG);

		for (const { status, expectedCode } of cases) {
			fetchSpy.mockResolvedValueOnce(
				new Response(JSON.stringify({ errors: `Error ${status}` }), {
					status,
					headers: { "Content-Type": "application/json" },
				}),
			);

			try {
				await client.getThemes();
				expect.unreachable(`Should have thrown for status ${status}`);
			} catch (err) {
				expect(err).toBeInstanceOf(ShopifyApiError);
				expect((err as ShopifyApiError).code).toBe(expectedCode);
				expect((err as ShopifyApiError).statusCode).toBe(status);
			}
		}
	});
});
