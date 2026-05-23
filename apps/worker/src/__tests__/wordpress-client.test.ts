import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	WordPressApiError,
	WordPressClient,
	type WordPressClientConfig,
} from "../lib/wordpress-client.js";

const BASE_CONFIG: WordPressClientConfig = {
	baseUrl: "https://example.com",
	username: "admin",
	appPassword: "xxxx yyyy zzzz",
};

describe("WordPressClient", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("builds correct Basic Auth header with spaces stripped from app password", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify([]), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const client = new WordPressClient(BASE_CONFIG);
		await client.getPageBySlug("test");

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		const authHeader = (init.headers as Record<string, string>).Authorization;

		// Spaces removed: "xxxxyyyy zzzz" -> "xxxxyyyyzzzz"
		const expected = `Basic ${Buffer.from("admin:xxxxyyyyzzzz").toString("base64")}`;
		expect(authHeader).toBe(expected);
	});

	it("getPageBySlug returns null when no pages match", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify([]), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const client = new WordPressClient(BASE_CONFIG);
		const page = await client.getPageBySlug("non-existent");
		expect(page).toBeNull();
	});

	it("createPage sends POST with correct body", async () => {
		const mockPage = {
			id: 42,
			slug: "llms-txt",
			title: { rendered: "llms.txt" },
			content: { rendered: "<pre>content</pre>" },
			status: "publish",
			link: "https://example.com/llms-txt/",
		};
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify(mockPage), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const client = new WordPressClient(BASE_CONFIG);
		const result = await client.createPage({
			slug: "llms-txt",
			title: "llms.txt",
			content: "<pre>content</pre>",
			status: "publish",
		});

		expect(result.id).toBe(42);
		expect(result.slug).toBe("llms-txt");

		const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://example.com/wp-json/wp/v2/pages");
		expect(init.method).toBe("POST");

		const body = JSON.parse(init.body as string);
		expect(body.slug).toBe("llms-txt");
		expect(body.title).toBe("llms.txt");
		expect(body.content).toBe("<pre>content</pre>");
		expect(body.status).toBe("publish");
	});

	it("maps HTTP 401 to AUTH_FAILED error", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const client = new WordPressClient(BASE_CONFIG);
		await expect(client.getPageBySlug("test")).rejects.toThrow(WordPressApiError);

		try {
			await client.getPageBySlug("test");
		} catch (err) {
			// fetch was already consumed, re-check from first call
		}

		// Verify the error code from the first rejection
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			}),
		);

		try {
			await client.getPageBySlug("test");
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(WordPressApiError);
			expect((err as WordPressApiError).code).toBe("AUTH_FAILED");
			expect((err as WordPressApiError).statusCode).toBe(401);
		}
	});

	it("maps fetch timeout to TIMEOUT error", async () => {
		const timeoutError = new Error("timeout");
		timeoutError.name = "TimeoutError";
		fetchSpy.mockRejectedValueOnce(timeoutError);

		const client = new WordPressClient(BASE_CONFIG);

		try {
			await client.getPageBySlug("test");
			expect.unreachable("Should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(WordPressApiError);
			expect((err as WordPressApiError).code).toBe("TIMEOUT");
		}
	});

	it("updatePage sends POST to /pages/{id} with content body", async () => {
		const mockPage = {
			id: 99,
			slug: "llms-txt",
			title: { rendered: "llms.txt" },
			content: { rendered: "<pre>new content</pre>" },
			status: "publish",
			link: "https://example.com/llms-txt/",
		};
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify(mockPage), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const client = new WordPressClient(BASE_CONFIG);
		const result = await client.updatePage(99, { content: "<pre>new content</pre>" });

		expect(result.id).toBe(99);
		const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://example.com/wp-json/wp/v2/pages/99");
		expect(init.method).toBe("POST");
		const body = JSON.parse(init.body as string);
		expect(body.content).toBe("<pre>new content</pre>");
	});

	it("deletePage sends DELETE to /pages/{id}", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ deleted: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const client = new WordPressClient(BASE_CONFIG);
		await client.deletePage(42);

		const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://example.com/wp-json/wp/v2/pages/42");
		expect(init.method).toBe("DELETE");
	});
});
