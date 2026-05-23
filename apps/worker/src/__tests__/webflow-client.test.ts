import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebflowApiError, WebflowClient, type WebflowClientConfig } from "../lib/webflow-client.js";

const BASE_CONFIG: WebflowClientConfig = {
	siteId: "site_abc123",
	apiToken: "wf_token_xyz",
};

describe("WebflowClient", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("sends Bearer auth header on every request", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ scripts: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const client = new WebflowClient(BASE_CONFIG);
		await client.getCustomCode();

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		const authHeader = (init.headers as Record<string, string>).Authorization;
		expect(authHeader).toBe("Bearer wf_token_xyz");
	});

	it("getCustomCode calls correct endpoint and returns scripts", async () => {
		const mockResponse = {
			scripts: [
				{
					id: "script_1",
					displayName: "Analytics",
					location: "header",
					version: "1.0.0",
					sourceCode: "<script>/* analytics */</script>",
				},
			],
		};
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify(mockResponse), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const client = new WebflowClient(BASE_CONFIG);
		const result = await client.getCustomCode();

		expect(result.scripts).toHaveLength(1);
		expect(result.scripts?.[0].displayName).toBe("Analytics");

		const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://api.webflow.com/v2/sites/site_abc123/custom_code");
		expect(init.method).toBe("GET");
	});

	it("upsertCustomCode sends PUT with scripts body", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ scripts: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const scripts = [
			{
				displayName: "Beacon JSON-LD",
				location: "header" as const,
				version: "1.0.0",
				sourceCode: '<script type="application/ld+json">{"@context":"https://schema.org"}</script>',
			},
		];

		const client = new WebflowClient(BASE_CONFIG);
		await client.upsertCustomCode(scripts);

		const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://api.webflow.com/v2/sites/site_abc123/custom_code");
		expect(init.method).toBe("PUT");

		const body = JSON.parse(init.body as string);
		expect(body.scripts).toHaveLength(1);
		expect(body.scripts[0].displayName).toBe("Beacon JSON-LD");
	});

	it("publishSite calls POST to publish endpoint", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response("", {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const client = new WebflowClient(BASE_CONFIG);
		await client.publishSite();

		const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://api.webflow.com/v2/sites/site_abc123/publish");
		expect(init.method).toBe("POST");
	});

	it("maps HTTP status codes to typed errors", async () => {
		const cases: Array<{ status: number; expectedCode: string }> = [
			{ status: 401, expectedCode: "AUTH_FAILED" },
			{ status: 403, expectedCode: "PERMISSION_DENIED" },
			{ status: 404, expectedCode: "NOT_FOUND" },
			{ status: 429, expectedCode: "RATE_LIMITED" },
			{ status: 500, expectedCode: "CMS_ERROR" },
		];

		const client = new WebflowClient(BASE_CONFIG);

		for (const { status, expectedCode } of cases) {
			fetchSpy.mockResolvedValueOnce(
				new Response(JSON.stringify({ message: `Error ${status}` }), {
					status,
					headers: { "Content-Type": "application/json" },
				}),
			);

			try {
				await client.getCustomCode();
				expect.unreachable(`Should have thrown for status ${status}`);
			} catch (err) {
				expect(err).toBeInstanceOf(WebflowApiError);
				expect((err as WebflowApiError).code).toBe(expectedCode);
				expect((err as WebflowApiError).statusCode).toBe(status);
			}
		}
	});

	it("maps fetch timeout to TIMEOUT error", async () => {
		const timeoutError = new Error("timeout");
		timeoutError.name = "TimeoutError";
		fetchSpy.mockRejectedValueOnce(timeoutError);

		const client = new WebflowClient(BASE_CONFIG);

		try {
			await client.getCustomCode();
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(WebflowApiError);
			expect((err as WebflowApiError).code).toBe("TIMEOUT");
		}
	});
});
