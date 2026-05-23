import { type LookupAddress, promises as dnsPromises } from "node:dns";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FetchError, assertSafeUrl, fetchUrl, isBlockedIp } from "../fetcher.js";

// Mock undici — must be before any import that triggers fetcher module load
vi.mock("undici", async (importOriginal) => {
	const actual = await importOriginal<typeof import("undici")>();
	return {
		...actual,
		fetch: vi.fn(),
		Agent: actual.Agent,
	};
});

// Import the mocked fetch for use in tests
import { fetch as undiciFetch } from "undici";
const mockedFetch = vi.mocked(undiciFetch);
type UndiciFetchInit = Parameters<typeof undiciFetch>[1];

function lookupAddresses(...results: LookupAddress[]): LookupAddress[] {
	return results;
}

function getSignal(init?: UndiciFetchInit): AbortSignal | undefined {
	return init?.signal;
}

async function listenOnLoopback(server: http.Server): Promise<number | null> {
	return await new Promise<number | null>((resolve, reject) => {
		server.once("error", (error: NodeJS.ErrnoException) => {
			if (error.code === "EPERM" || error.code === "EACCES") {
				resolve(null);
				return;
			}
			reject(error);
		});
		server.once("listening", () => {
			resolve((server.address() as AddressInfo).port);
		});
		server.listen(0, "127.0.0.1");
	});
}

async function closeServer(server: http.Server): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		server.close((error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
	});
}

describe("assertSafeUrl", () => {
	it("allows valid HTTPS URLs", () => {
		expect(() => assertSafeUrl("https://example.com")).not.toThrow();
	});

	it("allows valid HTTP URLs", () => {
		expect(() => assertSafeUrl("http://example.com")).not.toThrow();
	});

	it("blocks localhost", () => {
		expect(() => assertSafeUrl("http://localhost")).toThrow(FetchError);
		expect(() => assertSafeUrl("http://localhost:3000")).toThrow(FetchError);
	});

	it("blocks 127.x.x.x", () => {
		expect(() => assertSafeUrl("http://127.0.0.1")).toThrow(FetchError);
		expect(() => assertSafeUrl("http://127.0.0.1:8080")).toThrow(FetchError);
	});

	it("blocks 10.x.x.x private range", () => {
		expect(() => assertSafeUrl("http://10.0.0.1")).toThrow(FetchError);
	});

	it("blocks 192.168.x.x private range", () => {
		expect(() => assertSafeUrl("http://192.168.1.1")).toThrow(FetchError);
	});

	it("blocks 172.16-31.x.x private range", () => {
		expect(() => assertSafeUrl("http://172.16.0.1")).toThrow(FetchError);
		expect(() => assertSafeUrl("http://172.31.255.255")).toThrow(FetchError);
	});

	it("allows 172.32.x.x (not private)", () => {
		expect(() => assertSafeUrl("http://172.32.0.1")).not.toThrow();
	});

	it("blocks cloud metadata endpoint", () => {
		expect(() => assertSafeUrl("http://169.254.169.254")).toThrow(FetchError);
		expect(() => assertSafeUrl("http://metadata.google.internal")).toThrow(FetchError);
	});

	it("blocks Azure metadata endpoint", () => {
		expect(() => assertSafeUrl("http://metadata.azure.internal")).toThrow(FetchError);
	});

	it("blocks non-http protocols", () => {
		expect(() => assertSafeUrl("ftp://example.com")).toThrow(FetchError);
		expect(() => assertSafeUrl("file:///etc/passwd")).toThrow(FetchError);
	});

	it("throws UNSAFE_URL for invalid URLs", () => {
		expect.assertions(2);
		try {
			assertSafeUrl("not-a-url");
		} catch (e) {
			expect(e).toBeInstanceOf(FetchError);
			expect((e as FetchError).code).toBe("UNSAFE_URL");
		}
	});

	it("throws SSRF_BLOCKED for private IPs", () => {
		expect.assertions(2);
		try {
			assertSafeUrl("http://10.0.0.1");
		} catch (e) {
			expect(e).toBeInstanceOf(FetchError);
			expect((e as FetchError).code).toBe("SSRF_BLOCKED");
		}
	});

	it("blocks IPv6 private addresses", () => {
		expect(() => assertSafeUrl("http://[::1]")).toThrow(FetchError);
		expect(() => assertSafeUrl("http://[fc00::1]")).toThrow(FetchError);
		expect(() => assertSafeUrl("http://[fd12::1]")).toThrow(FetchError);
		expect(() => assertSafeUrl("http://[fe80::1]")).toThrow(FetchError);
	});

	it("blocks fc00::/7 — fcab::1", () => {
		expect(() => assertSafeUrl("http://[fcab::1]")).toThrow(FetchError);
	});

	it("blocks fc00::/7 — fc12::1", () => {
		expect(() => assertSafeUrl("http://[fc12::1]")).toThrow(FetchError);
	});

	it("blocks fe80::/10 — fe90::1", () => {
		expect(() => assertSafeUrl("http://[fe90::1]")).toThrow(FetchError);
	});

	it("blocks fe80::/10 — febf::1", () => {
		expect(() => assertSafeUrl("http://[febf::1]")).toThrow(FetchError);
	});

	it("allows fec0::1 (outside blocked ranges)", () => {
		expect(() => assertSafeUrl("http://[fec0::1]")).not.toThrow();
	});

	it("blocks IPv4-mapped IPv6 addresses", () => {
		expect(() => assertSafeUrl("http://[::ffff:127.0.0.1]")).toThrow(FetchError);
		expect(() => assertSafeUrl("http://[::ffff:10.0.0.1]")).toThrow(FetchError);
		expect(() => assertSafeUrl("http://[::ffff:169.254.169.254]")).toThrow(FetchError);
	});

	it("blocks expanded IPv4-mapped IPv6 addresses", () => {
		expect(() => assertSafeUrl("http://[0:0:0:0:0:ffff:7f00:1]")).toThrow(FetchError);
	});

	it("blocks SIIT IPv4-translatable addresses (::ffff:0:127.0.0.1)", () => {
		expect(() => assertSafeUrl("http://[::ffff:0:127.0.0.1]")).toThrow(FetchError);
		expect(() => assertSafeUrl("http://[::ffff:0:10.0.0.1]")).toThrow(FetchError);
	});

	it("blocks AWS IMDSv2 IPv6 address", () => {
		expect(() => assertSafeUrl("http://[fd00:ec2::254]")).toThrow(FetchError);
	});

	it("blocks 0.0.0.0", () => {
		expect(() => assertSafeUrl("http://0.0.0.0")).toThrow(FetchError);
	});

	it("blocks :: (all-zeros IPv6)", () => {
		expect(() => assertSafeUrl("http://[::]")).toThrow(FetchError);
	});

	it("blocks 100.100.100.200 (Alibaba Cloud metadata)", () => {
		expect(() => assertSafeUrl("http://100.100.100.200")).toThrow(FetchError);
	});

	it("blocks localhost with trailing dot", () => {
		expect(() => assertSafeUrl("http://localhost.")).toThrow(FetchError);
	});

	it("blocks metadata.google.internal with trailing dot", () => {
		expect(() => assertSafeUrl("http://metadata.google.internal.")).toThrow(FetchError);
	});

	it("does not block hostname that starts with IP-like prefix", () => {
		expect(() => assertSafeUrl("http://127.example.com")).not.toThrow();
		expect(() => assertSafeUrl("http://10.example.com")).not.toThrow();
	});

	it("does not leak credentials in errors", () => {
		try {
			assertSafeUrl("http://user:pass@localhost");
		} catch (e) {
			const msg = (e as FetchError).message;
			expect(msg).not.toContain("user");
			expect(msg).not.toContain("pass");
		}
	});
});

describe("isBlockedIp", () => {
	it("does not block hostname that starts with IP-like prefix (127.example.com)", () => {
		expect(isBlockedIp("127.example.com")).toBe(false);
	});

	it("does not block hostname 10.example.com", () => {
		expect(isBlockedIp("10.example.com")).toBe(false);
	});

	it("still blocks actual IPv4 loopback", () => {
		expect(isBlockedIp("127.0.0.1")).toBe(true);
	});

	it("still blocks actual IPv4 private range", () => {
		expect(isBlockedIp("10.0.0.1")).toBe(true);
	});

	it("detects IPv4-mapped ::ffff:127.0.0.1", () => {
		expect(isBlockedIp("::ffff:127.0.0.1")).toBe(true);
	});

	it("detects IPv4-mapped ::ffff:10.0.0.1", () => {
		expect(isBlockedIp("::ffff:10.0.0.1")).toBe(true);
	});

	it("detects IPv4-mapped hex ::ffff:7f00:1", () => {
		expect(isBlockedIp("::ffff:7f00:1")).toBe(true);
	});

	it("allows safe IPv4-mapped ::ffff:93.184.216.34", () => {
		expect(isBlockedIp("::ffff:93.184.216.34")).toBe(false);
	});

	it("detects expanded IPv4-mapped 0:0:0:0:0:ffff:7f00:1 (127.0.0.1)", () => {
		expect(isBlockedIp("0:0:0:0:0:ffff:7f00:1")).toBe(true);
	});

	it("detects expanded IPv4-mapped 0:0:0:0:0:ffff:a00:1 (10.0.0.1)", () => {
		expect(isBlockedIp("0:0:0:0:0:ffff:a00:1")).toBe(true);
	});

	it("allows safe expanded IPv4-mapped 0:0:0:0:0:ffff:5db8:d822 (93.184.216.34)", () => {
		expect(isBlockedIp("0:0:0:0:0:ffff:5db8:d822")).toBe(false);
	});

	it("detects SIIT IPv4-translatable ::ffff:0:7f00:1 (127.0.0.1)", () => {
		expect(isBlockedIp("::ffff:0:7f00:1")).toBe(true);
	});

	it("detects SIIT IPv4-translatable ::ffff:0:a00:1 (10.0.0.1)", () => {
		expect(isBlockedIp("::ffff:0:a00:1")).toBe(true);
	});

	it("allows safe SIIT IPv4-translatable ::ffff:0:5db8:d822 (93.184.216.34)", () => {
		expect(isBlockedIp("::ffff:0:5db8:d822")).toBe(false);
	});

	it("detects SIIT dotted-decimal ::ffff:0:127.0.0.1", () => {
		expect(isBlockedIp("::ffff:0:127.0.0.1")).toBe(true);
	});

	it("allows safe SIIT dotted-decimal ::ffff:0:93.184.216.34", () => {
		expect(isBlockedIp("::ffff:0:93.184.216.34")).toBe(false);
	});
});

describe("FetchError", () => {
	it("has correct name and code", () => {
		const err = new FetchError("test", "FETCH_FAILED");
		expect(err.name).toBe("FetchError");
		expect(err.code).toBe("FETCH_FAILED");
		expect(err.message).toBe("test");
	});

	it("preserves error cause", () => {
		const cause = new TypeError("original error");
		const err = new FetchError("wrapped", "FETCH_FAILED", { cause });
		expect(err.cause).toBe(cause);
	});
});

describe("fetchUrl", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	// Default DNS mock: resolve to a safe public IP
	beforeEach(() => {
		vi.spyOn(dnsPromises, "lookup").mockResolvedValue(
			lookupAddresses({ address: "93.184.216.34", family: 4 }),
		);
	});

	it("returns FetchResult on successful fetch", async () => {
		const mockHtml = "<html><body>Hello</body></html>";

		mockedFetch.mockResolvedValueOnce(
			new Response(mockHtml, {
				status: 200,
				headers: { "Content-Type": "text/html" },
			}),
		);

		const result = await fetchUrl("https://example.com");

		expect(result.html).toBe(mockHtml);
		expect(result.statusCode).toBe(200);
		expect(result.responseTime).toBeGreaterThanOrEqual(0);
		expect(result.redirects).toEqual([]);
		expect(result.finalUrl).toBe("https://example.com");
	});

	it("throws SSRF_BLOCKED when redirect targets a private IP", async () => {
		mockedFetch.mockResolvedValueOnce(
			new Response(null, {
				status: 301,
				headers: { Location: "http://10.0.0.1" },
			}),
		);

		await expect(fetchUrl("https://example.com")).rejects.toThrow(FetchError);

		// Re-mock to verify the error code
		mockedFetch.mockResolvedValueOnce(
			new Response(null, {
				status: 301,
				headers: { Location: "http://10.0.0.1" },
			}),
		);

		try {
			await fetchUrl("https://example.com");
			expect.fail("Expected fetchUrl to throw");
		} catch (e) {
			expect((e as FetchError).code).toBe("SSRF_BLOCKED");
		}
	});

	it("throws FETCH_FAILED after exceeding max redirects", async () => {
		let callCount = 0;
		mockedFetch.mockImplementation(async () => {
			callCount++;
			return new Response(null, {
				status: 301,
				headers: { Location: `https://example.com/next-${callCount}` },
			});
		});

		try {
			await fetchUrl("https://example.com");
			expect.fail("Expected fetchUrl to throw");
		} catch (e) {
			expect(e).toBeInstanceOf(FetchError);
			expect((e as FetchError).code).toBe("FETCH_FAILED");
			expect((e as FetchError).message).toContain("Too many redirects");
		}

		expect(mockedFetch).toHaveBeenCalledTimes(5);
	});

	it("follows a single redirect successfully", async () => {
		mockedFetch
			.mockResolvedValueOnce(
				new Response(null, {
					status: 301,
					headers: { Location: "https://example.com/final" },
				}),
			)
			.mockResolvedValueOnce(
				new Response("<html>redirected</html>", {
					status: 200,
					headers: { "Content-Type": "text/html" },
				}),
			);

		const result = await fetchUrl("https://example.com");

		expect(result.html).toBe("<html>redirected</html>");
		expect(result.statusCode).toBe(200);
		expect(result.finalUrl).toBe("https://example.com/final");
		expect(result.redirects).toEqual(["https://example.com/final"]);
		expect(mockedFetch).toHaveBeenCalledTimes(2);
	});

	it("throws RESPONSE_TOO_LARGE when content-length exceeds limit", async () => {
		mockedFetch.mockResolvedValueOnce(
			new Response("x", {
				status: 200,
				headers: {
					"Content-Type": "text/html",
					"Content-Length": String(11 * 1024 * 1024), // 11 MB
				},
			}),
		);

		try {
			await fetchUrl("https://example.com");
			expect.fail("Expected fetchUrl to throw");
		} catch (e) {
			expect(e).toBeInstanceOf(FetchError);
			expect((e as FetchError).code).toBe("RESPONSE_TOO_LARGE");
		}
	});

	it("throws RESPONSE_TOO_LARGE when streamed body exceeds limit", async () => {
		// Create a response with no content-length but a large body
		const largeChunk = new Uint8Array(6 * 1024 * 1024); // 6 MB per chunk
		let callCount = 0;
		const stream = new ReadableStream({
			pull(controller) {
				callCount++;
				if (callCount <= 2) {
					controller.enqueue(largeChunk); // 2 chunks = 12 MB > 10 MB limit
				} else {
					controller.close();
				}
			},
		});

		mockedFetch.mockResolvedValueOnce(
			new Response(stream, {
				status: 200,
				headers: { "Content-Type": "text/html" },
			}),
		);

		try {
			await fetchUrl("https://example.com");
			expect.fail("Expected fetchUrl to throw");
		} catch (e) {
			expect(e).toBeInstanceOf(FetchError);
			expect((e as FetchError).code).toBe("RESPONSE_TOO_LARGE");
		}
	});

	it("allows responses within size limit", async () => {
		const normalHtml = "<html><body>Normal page</body></html>";

		mockedFetch.mockResolvedValueOnce(
			new Response(normalHtml, {
				status: 200,
				headers: { "Content-Type": "text/html" },
			}),
		);

		const result = await fetchUrl("https://example.com");
		expect(result.html).toBe(normalHtml);
		expect(result.statusCode).toBe(200);
	});

	it("returns non-2xx status without throwing", async () => {
		mockedFetch.mockResolvedValueOnce(
			new Response("Not Found", {
				status: 404,
				headers: { "Content-Type": "text/html" },
			}),
		);

		const result = await fetchUrl("https://example.com/missing");

		expect(result.statusCode).toBe(404);
		expect(result.html).toBe("Not Found");
		expect(result.finalUrl).toBe("https://example.com/missing");
	});

	it("handles NaN content-length gracefully", async () => {
		mockedFetch.mockResolvedValueOnce(
			new Response("small body", {
				status: 200,
				headers: {
					"Content-Type": "text/html",
					"Content-Length": "not-a-number",
				},
			}),
		);

		const result = await fetchUrl("https://example.com");
		expect(result.html).toBe("small body");
	});

	it("returns TIMEOUT code on timeout", async () => {
		mockedFetch.mockRejectedValueOnce(
			new DOMException("The operation was aborted", "TimeoutError"),
		);

		try {
			await fetchUrl("https://example.com");
			expect.fail("Expected fetchUrl to throw");
		} catch (e) {
			expect(e).toBeInstanceOf(FetchError);
			expect((e as FetchError).code).toBe("TIMEOUT");
			expect((e as FetchError).message).toContain("timed out");
		}
	});

	it("returns TIMEOUT when body read aborts with AbortError", async () => {
		vi.useFakeTimers();

		try {
			mockedFetch.mockImplementationOnce(async (_input, init) => {
				const signal = getSignal(init);
				const stream = new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("partial"));
						signal?.addEventListener(
							"abort",
							() => {
								controller.error(new DOMException("The operation was aborted", "AbortError"));
							},
							{ once: true },
						);
					},
				});

				return new Response(stream, {
					status: 200,
					headers: { "Content-Type": "text/html" },
				});
			});

			const promise = fetchUrl("https://example.com", 50);
			await vi.advanceTimersByTimeAsync(50);

			await expect(promise).rejects.toMatchObject({
				code: "TIMEOUT",
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it("preserves error cause in FETCH_FAILED", async () => {
		const original = new TypeError("fetch failed");
		mockedFetch.mockRejectedValueOnce(original);

		try {
			await fetchUrl("https://example.com");
			expect.fail("Expected fetchUrl to throw");
		} catch (e) {
			expect(e).toBeInstanceOf(FetchError);
			expect((e as FetchError).code).toBe("FETCH_FAILED");
			expect((e as FetchError).cause).toBe(original);
		}
	});

	it("detects redirect loops", async () => {
		mockedFetch
			.mockResolvedValueOnce(
				new Response(null, {
					status: 301,
					headers: { Location: "https://example.com/b" },
				}),
			)
			.mockResolvedValueOnce(
				new Response(null, {
					status: 301,
					headers: { Location: "https://example.com/" },
				}),
			);

		try {
			await fetchUrl("https://example.com");
			expect.fail("Expected fetchUrl to throw");
		} catch (e) {
			expect(e).toBeInstanceOf(FetchError);
			expect((e as FetchError).code).toBe("FETCH_FAILED");
			expect((e as FetchError).message).toContain("loop");
		}
	});

	it("strips fragment from redirect Location", async () => {
		mockedFetch
			.mockResolvedValueOnce(
				new Response(null, {
					status: 301,
					headers: { Location: "https://example.com/page#section" },
				}),
			)
			.mockResolvedValueOnce(
				new Response("ok", {
					status: 200,
					headers: { "Content-Type": "text/html" },
				}),
			);

		const result = await fetchUrl("https://example.com");
		// The redirect URL stored should NOT have the fragment
		expect(result.redirects[0]).toBe("https://example.com/page");
		expect(mockedFetch).toHaveBeenCalledTimes(2);
	});

	it("blocks javascript: in redirect Location", async () => {
		mockedFetch.mockResolvedValueOnce(
			new Response(null, {
				status: 301,
				headers: { Location: "javascript:alert(1)" },
			}),
		);

		try {
			await fetchUrl("https://example.com");
			expect.fail("Expected fetchUrl to throw");
		} catch (e) {
			expect(e).toBeInstanceOf(FetchError);
			expect((e as FetchError).code).toBe("UNSAFE_URL");
		}
	});

	it("blocks data: in redirect Location", async () => {
		mockedFetch.mockResolvedValueOnce(
			new Response(null, {
				status: 301,
				headers: { Location: "data:text/html,<h1>hi</h1>" },
			}),
		);

		try {
			await fetchUrl("https://example.com");
			expect.fail("Expected fetchUrl to throw");
		} catch (e) {
			expect(e).toBeInstanceOf(FetchError);
			expect((e as FetchError).code).toBe("UNSAFE_URL");
		}
	});

	it("handles null response body", async () => {
		mockedFetch.mockResolvedValueOnce(
			new Response(null, {
				status: 200,
				headers: { "Content-Type": "text/html" },
			}),
		);

		const result = await fetchUrl("https://example.com");
		expect(result.html).toBe("");
	});

	it("wraps network errors as FETCH_FAILED", async () => {
		mockedFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

		try {
			await fetchUrl("https://example.com");
			expect.fail("Expected fetchUrl to throw");
		} catch (e) {
			expect(e).toBeInstanceOf(FetchError);
			expect((e as FetchError).code).toBe("FETCH_FAILED");
		}
	});

	it("throws FETCH_FAILED for redirect without Location header", async () => {
		mockedFetch.mockResolvedValueOnce(new Response(null, { status: 301 }));

		try {
			await fetchUrl("https://example.com");
			expect.fail("Expected fetchUrl to throw");
		} catch (e) {
			expect(e).toBeInstanceOf(FetchError);
			expect((e as FetchError).code).toBe("FETCH_FAILED");
			expect((e as FetchError).message).toContain("Location");
		}
	});

	it("handles Content-Length spoofing (header says small, body exceeds)", async () => {
		const largeChunk = new Uint8Array(6 * 1024 * 1024);
		let callCount = 0;
		const stream = new ReadableStream({
			pull(controller) {
				callCount++;
				if (callCount <= 2) {
					controller.enqueue(largeChunk);
				} else {
					controller.close();
				}
			},
		});

		mockedFetch.mockResolvedValueOnce(
			new Response(stream, {
				status: 200,
				headers: {
					"Content-Type": "text/html",
					"Content-Length": "100", // lies about body size
				},
			}),
		);

		try {
			await fetchUrl("https://example.com");
			expect.fail("Expected fetchUrl to throw");
		} catch (e) {
			expect(e).toBeInstanceOf(FetchError);
			expect((e as FetchError).code).toBe("RESPONSE_TOO_LARGE");
		}
	});

	it("resolves relative redirect URLs", async () => {
		mockedFetch
			.mockResolvedValueOnce(
				new Response(null, {
					status: 301,
					headers: { Location: "/other-page" },
				}),
			)
			.mockResolvedValueOnce(
				new Response("ok", {
					status: 200,
					headers: { "Content-Type": "text/html" },
				}),
			);

		const result = await fetchUrl("https://example.com");
		expect(result.redirects[0]).toBe("https://example.com/other-page");
		expect(result.finalUrl).toBe("https://example.com/other-page");
		expect(mockedFetch).toHaveBeenCalledTimes(2);
	});

	it("does not leak credentials in fetch error messages", async () => {
		mockedFetch.mockRejectedValueOnce(new TypeError("network error"));

		try {
			await fetchUrl("https://user:secret@example.com");
			expect.fail("Expected fetchUrl to throw");
		} catch (e) {
			const msg = (e as FetchError).message;
			expect(msg).not.toContain("user");
			expect(msg).not.toContain("secret");
		}
	});

	it("sends BeaconBot/1.0 User-Agent header", async () => {
		let capturedInit: UndiciFetchInit;
		mockedFetch.mockImplementationOnce(async (_input, init) => {
			capturedInit = init;
			return new Response("ok", { status: 200 });
		});
		await fetchUrl("https://example.com");
		expect(new Headers(capturedInit?.headers as HeadersInit).get("User-Agent")).toBe(
			"BeaconBot/1.0",
		);
	});

	it("cancels response body when Content-Length exceeds limit", async () => {
		let cancelCalled = false;
		const stream = new ReadableStream({
			cancel() {
				cancelCalled = true;
			},
		});
		mockedFetch.mockResolvedValueOnce(
			new Response(stream, {
				status: 200,
				headers: { "Content-Length": String(11 * 1024 * 1024) },
			}),
		);
		await expect(fetchUrl("https://example.com")).rejects.toMatchObject({
			code: "RESPONSE_TOO_LARGE",
		});
		expect(cancelCalled).toBe(true);
	});

	it("throws SSRF_BLOCKED when DNS resolves to private IPv4", async () => {
		vi.spyOn(dnsPromises, "lookup").mockResolvedValue(
			lookupAddresses({ address: "10.0.0.1", family: 4 }),
		);

		await expect(fetchUrl("https://evil.example.com")).rejects.toMatchObject({
			code: "SSRF_BLOCKED",
		});
	});

	it("throws SSRF_BLOCKED when DNS resolves to link-local IPv6", async () => {
		vi.spyOn(dnsPromises, "lookup").mockResolvedValue(
			lookupAddresses({ address: "fe90::1", family: 6 }),
		);

		await expect(fetchUrl("https://evil.example.com")).rejects.toMatchObject({
			code: "SSRF_BLOCKED",
		});
	});

	it("skips DNS lookup for IP literals", async () => {
		const lookupSpy = vi
			.spyOn(dnsPromises, "lookup")
			.mockResolvedValue(lookupAddresses({ address: "93.184.216.34", family: 4 }));
		mockedFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

		await fetchUrl("https://93.184.216.34");
		expect(lookupSpy).not.toHaveBeenCalled();
	});

	it("throws SSRF_BLOCKED when DNS resolves to IPv4-mapped private IP", async () => {
		vi.spyOn(dnsPromises, "lookup").mockResolvedValue(
			lookupAddresses({ address: "::ffff:10.0.0.1", family: 6 }),
		);

		await expect(fetchUrl("https://evil.example.com")).rejects.toMatchObject({
			code: "SSRF_BLOCKED",
		});
	});

	it("proceeds when hostname does not resolve (ENOTFOUND)", async () => {
		vi.spyOn(dnsPromises, "lookup").mockRejectedValue(
			Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }),
		);
		mockedFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

		await expect(fetchUrl("https://nonexistent.example.com")).rejects.toMatchObject({
			code: "FETCH_FAILED",
		});
	});

	it("throws FETCH_FAILED on transient DNS error (EAI_AGAIN)", async () => {
		vi.spyOn(dnsPromises, "lookup").mockRejectedValue(
			Object.assign(new Error("getaddrinfo EAI_AGAIN"), { code: "EAI_AGAIN" }),
		);

		await expect(fetchUrl("https://example.com")).rejects.toMatchObject({
			code: "FETCH_FAILED",
		});
	});

	it("throws TIMEOUT when DNS lookup times out", async () => {
		vi.spyOn(dnsPromises, "lookup").mockRejectedValue(
			new DOMException("The operation was aborted", "AbortError"),
		);

		await expect(fetchUrl("https://example.com")).rejects.toMatchObject({
			code: "TIMEOUT",
		});
	});

	it("throws TIMEOUT when DNS lookup throws TimeoutError", async () => {
		vi.spyOn(dnsPromises, "lookup").mockRejectedValue(
			new DOMException("The operation timed out", "TimeoutError"),
		);

		await expect(fetchUrl("https://example.com")).rejects.toMatchObject({
			code: "TIMEOUT",
		});
	});

	it("throws TIMEOUT with ABORT_ERR code from DNS", async () => {
		vi.spyOn(dnsPromises, "lookup").mockRejectedValue(
			Object.assign(new Error("aborted"), { code: "ABORT_ERR" }),
		);

		await expect(fetchUrl("https://example.com")).rejects.toMatchObject({
			code: "TIMEOUT",
		});
	});

	it("shrinks fetch signal timeout after DNS consumes budget", async () => {
		vi.useFakeTimers();

		// DNS lookup "takes" 100ms of the 200ms budget
		vi.spyOn(dnsPromises, "lookup").mockImplementation(async () => {
			vi.advanceTimersByTime(100);
			return lookupAddresses({ address: "93.184.216.34", family: 4 });
		});

		let capturedTimeout: number | undefined;
		const origTimeout = AbortSignal.timeout;
		vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
			capturedTimeout = ms;
			return origTimeout.call(AbortSignal, ms);
		});

		mockedFetch.mockImplementation(async () => {
			return new Response("ok", { status: 200 });
		});

		await fetchUrl("https://example.com", 200);

		// fetch must have received a signal with <= 100ms, not the full 200ms
		expect(capturedTimeout).toBeDefined();
		expect(capturedTimeout).toBeLessThanOrEqual(100);
		expect(capturedTimeout).toBeGreaterThan(0);

		vi.useRealTimers();
	});

	it("throws TIMEOUT when deadline is exhausted before second hop", async () => {
		vi.useFakeTimers();

		let dnsCallCount = 0;
		vi.spyOn(dnsPromises, "lookup").mockImplementation(async () => {
			dnsCallCount++;
			if (dnsCallCount === 1) {
				vi.advanceTimersByTime(150); // first DNS eats 150 of 200ms
			}
			return lookupAddresses({ address: "93.184.216.34", family: 4 });
		});

		mockedFetch.mockImplementation(async () => {
			vi.advanceTimersByTime(60); // fetch eats remaining ~50ms + more
			return new Response(null, {
				status: 301,
				headers: { Location: "https://example.com/next" },
			});
		});

		await expect(fetchUrl("https://example.com", 200)).rejects.toMatchObject({
			code: "TIMEOUT",
		});

		vi.useRealTimers();
	});

	it("throws SSRF_BLOCKED when DNS resolves to expanded IPv4-mapped private IP", async () => {
		vi.spyOn(dnsPromises, "lookup").mockResolvedValue(
			lookupAddresses({ address: "0:0:0:0:0:ffff:7f00:1", family: 6 }),
		);

		await expect(fetchUrl("https://evil.example.com")).rejects.toMatchObject({
			code: "SSRF_BLOCKED",
		});
	});

	it("throws SSRF_BLOCKED when DNS resolves to SIIT IPv4-translatable private IP", async () => {
		vi.spyOn(dnsPromises, "lookup").mockResolvedValue(
			lookupAddresses({ address: "::ffff:0:7f00:1", family: 6 }),
		);

		await expect(fetchUrl("https://evil.example.com")).rejects.toMatchObject({
			code: "SSRF_BLOCKED",
		});
	});

	it("enforces global deadline across redirect chain + body read", async () => {
		vi.useFakeTimers();

		try {
			let dnsCallCount = 0;
			vi.spyOn(dnsPromises, "lookup").mockImplementation(async () => {
				dnsCallCount++;
				// Each DNS call eats 30ms
				vi.advanceTimersByTime(30);
				return lookupAddresses({ address: "93.184.216.34", family: 4 });
			});

			let fetchCallCount = 0;
			mockedFetch.mockImplementation(async (_input, init) => {
				fetchCallCount++;
				// Each redirect hop eats 50ms
				vi.advanceTimersByTime(50);

				if (fetchCallCount <= 2) {
					return new Response(null, {
						status: 301,
						headers: { Location: `https://example.com/hop-${fetchCallCount}` },
					});
				}

				// Final response with slow body stream
				const signal = getSignal(init);
				const stream = new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("partial"));
						// Body read will stall until signal aborts
						signal?.addEventListener(
							"abort",
							() => {
								controller.error(new DOMException("The operation was aborted", "AbortError"));
							},
							{ once: true },
						);
					},
				});
				return new Response(stream, {
					status: 200,
					headers: { "Content-Type": "text/html" },
				});
			});

			// 300ms budget: 2 redirects × (30ms DNS + 50ms fetch) = 160ms,
			// 3rd hop DNS 30ms + fetch 50ms = 80ms → 240ms used, 60ms left for body
			const promise = fetchUrl("https://example.com", 300);
			// Advance past remaining budget to trigger timeout during body read
			await vi.advanceTimersByTimeAsync(300);

			await expect(promise).rejects.toMatchObject({
				code: "TIMEOUT",
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it("times out during body read when redirect chain consumes most budget", async () => {
		vi.useFakeTimers();

		try {
			vi.spyOn(dnsPromises, "lookup").mockImplementation(async () => {
				vi.advanceTimersByTime(10);
				return lookupAddresses({ address: "93.184.216.34", family: 4 });
			});

			let fetchCallCount = 0;
			mockedFetch.mockImplementation(async (_input, init) => {
				fetchCallCount++;

				if (fetchCallCount === 1) {
					// Redirect eats 160ms of 200ms budget
					vi.advanceTimersByTime(160);
					return new Response(null, {
						status: 301,
						headers: { Location: "https://example.com/final" },
					});
				}

				// Final response — slow body exceeds remaining ~20ms
				vi.advanceTimersByTime(5);
				const signal = getSignal(init);
				const stream = new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("chunk1"));
						signal?.addEventListener(
							"abort",
							() => {
								controller.error(new DOMException("The operation was aborted", "AbortError"));
							},
							{ once: true },
						);
					},
				});
				return new Response(stream, {
					status: 200,
					headers: { "Content-Type": "text/html" },
				});
			});

			const promise = fetchUrl("https://example.com", 200);
			await vi.advanceTimersByTimeAsync(200);

			await expect(promise).rejects.toMatchObject({
				code: "TIMEOUT",
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it("throws SSRF_BLOCKED when redirect targets hostname resolving to blocked IP", async () => {
		let dnsCallCount = 0;
		vi.spyOn(dnsPromises, "lookup").mockImplementation(async () => {
			dnsCallCount++;
			if (dnsCallCount === 1) {
				// First hop: safe
				return lookupAddresses({ address: "93.184.216.34", family: 4 });
			}
			// Redirect target resolves to private IP
			return lookupAddresses({ address: "10.0.0.1", family: 4 });
		});

		mockedFetch.mockResolvedValueOnce(
			new Response(null, {
				status: 301,
				headers: { Location: "https://evil.redirect.com/path" },
			}),
		);

		await expect(fetchUrl("https://example.com")).rejects.toMatchObject({
			code: "SSRF_BLOCKED",
		});
	});

	it("throws SSRF_BLOCKED when DNS returns mixed safe and blocked addresses", async () => {
		vi.spyOn(dnsPromises, "lookup").mockResolvedValue(
			lookupAddresses({ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }),
		);

		await expect(fetchUrl("https://example.com")).rejects.toMatchObject({
			code: "SSRF_BLOCKED",
		});
	});

	it("succeeds at exact MAX_RESPONSE_BYTES boundary (10MB)", async () => {
		const exactBody = new Uint8Array(10 * 1024 * 1024);
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(exactBody);
				controller.close();
			},
		});

		mockedFetch.mockResolvedValueOnce(
			new Response(stream, {
				status: 200,
				headers: { "Content-Type": "text/html" },
			}),
		);

		const result = await fetchUrl("https://example.com");
		expect(result.statusCode).toBe(200);
		expect(result.html.length).toBe(10 * 1024 * 1024);
	});

	it("cancels stream early on oversize streamed response", async () => {
		let cancelCalled = false;
		const chunk = new Uint8Array(6 * 1024 * 1024); // 6MB
		let enqueueCount = 0;
		const stream = new ReadableStream({
			pull(controller) {
				enqueueCount++;
				if (enqueueCount <= 3) {
					controller.enqueue(chunk);
				} else {
					controller.close();
				}
			},
			cancel() {
				cancelCalled = true;
			},
		});

		mockedFetch.mockResolvedValueOnce(
			new Response(stream, {
				status: 200,
				headers: { "Content-Type": "text/html" },
			}),
		);

		await expect(fetchUrl("https://example.com")).rejects.toMatchObject({
			code: "RESPONSE_TOO_LARGE",
		});
		expect(cancelCalled).toBe(true);
	});

	it("handles 204 No Content with null body", async () => {
		mockedFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

		const result = await fetchUrl("https://example.com");
		expect(result.statusCode).toBe(204);
		expect(result.html).toBe("");
	});

	it("handles Content-Length: 0 with empty body", async () => {
		mockedFetch.mockResolvedValueOnce(
			new Response("", {
				status: 200,
				headers: { "Content-Length": "0" },
			}),
		);

		const result = await fetchUrl("https://example.com");
		expect(result.statusCode).toBe(200);
		expect(result.html).toBe("");
	});

	it("body read succeeds within remaining budget after redirect", async () => {
		vi.useFakeTimers();

		try {
			vi.spyOn(dnsPromises, "lookup").mockImplementation(async () => {
				vi.advanceTimersByTime(10);
				return lookupAddresses({ address: "93.184.216.34", family: 4 });
			});

			let fetchCallCount = 0;
			mockedFetch.mockImplementation(async () => {
				fetchCallCount++;

				if (fetchCallCount === 1) {
					// Redirect consumes ~30% of 500ms budget
					vi.advanceTimersByTime(140);
					return new Response(null, {
						status: 301,
						headers: { Location: "https://example.com/final" },
					});
				}

				// Final response with fast body
				vi.advanceTimersByTime(20);
				return new Response("<html>done</html>", {
					status: 200,
					headers: { "Content-Type": "text/html" },
				});
			});

			const result = await fetchUrl("https://example.com", 500);

			expect(result.html).toBe("<html>done</html>");
			expect(result.statusCode).toBe(200);
			expect(result.redirects).toEqual(["https://example.com/final"]);
			expect(result.finalUrl).toBe("https://example.com/final");
		} finally {
			vi.useRealTimers();
		}
	});

	it("unwraps FetchError from nested cause chain (undici wrapping)", async () => {
		const inner = new FetchError(
			"DNS resolved to blocked IP: 10.0.0.1 for evil.test",
			"SSRF_BLOCKED",
		);
		const mid = new Error("connect failed");
		mid.cause = inner;
		const outer = new TypeError("fetch failed");
		outer.cause = mid;

		mockedFetch.mockRejectedValueOnce(outer);

		await expect(fetchUrl("https://example.com")).rejects.toMatchObject({
			code: "SSRF_BLOCKED",
		});
	});
});

describe("DNS rebinding protection", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("integration: connect-time lookup blocks rebinding — server receives 0 requests", async () => {
		// Use real undici fetch for this integration test
		const { fetch: realUndiciFetch } = await vi.importActual<typeof import("undici")>("undici");
		mockedFetch.mockImplementation(realUndiciFetch);

		let serverHits = 0;
		const server = http.createServer((_req, res) => {
			serverHits++;
			res.end("secret");
		});
		const port = await listenOnLoopback(server);
		if (port === null) return;

		try {
			let callCount = 0;
			vi.spyOn(dnsPromises, "lookup").mockImplementation(async () => {
				callCount++;
				if (callCount === 1) {
					// Preflight: safe IP (simulates rebinding window)
					return lookupAddresses({ address: "93.184.216.34", family: 4 });
				}
				// Connect-time: attacker rebinds to loopback
				return lookupAddresses({ address: "127.0.0.1", family: 4 });
			});

			await expect(fetchUrl(`http://evil.test:${port}/`)).rejects.toMatchObject({
				code: "SSRF_BLOCKED",
			});

			expect(serverHits).toBe(0);
		} finally {
			await closeServer(server);
		}
	});

	it("resolveSafeAddresses blocks when DNS returns mixed safe and blocked IPs", async () => {
		vi.spyOn(dnsPromises, "lookup").mockResolvedValue(
			lookupAddresses({ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }),
		);

		mockedFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

		await expect(fetchUrl("https://example.com")).rejects.toMatchObject({
			code: "SSRF_BLOCKED",
		});
	});

	it("resolveSafeAddresses blocks IPv6 ::1", async () => {
		vi.spyOn(dnsPromises, "lookup").mockResolvedValue(
			lookupAddresses({ address: "::1", family: 6 }),
		);

		mockedFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));

		await expect(fetchUrl("https://example.com")).rejects.toMatchObject({
			code: "SSRF_BLOCKED",
		});
	});

	it("ENOTFOUND from preflight does not trigger second uncontrolled lookup", async () => {
		const lookupSpy = vi
			.spyOn(dnsPromises, "lookup")
			.mockRejectedValue(
				Object.assign(new Error("getaddrinfo ENOTFOUND evil.test"), { code: "ENOTFOUND" }),
			);

		// The connect-time lookup should also get ENOTFOUND from resolveSafeAddresses
		// (which returns []), and then the lookup callback returns a controlled ENOTFOUND
		mockedFetch.mockRejectedValueOnce(
			Object.assign(new Error("getaddrinfo ENOTFOUND evil.test"), { code: "ENOTFOUND" }),
		);

		await expect(fetchUrl("https://evil.test")).rejects.toMatchObject({
			code: "FETCH_FAILED",
		});

		// DNS was called for the preflight assertSafeHostDns, plus the connect-time lookup
		// Both go through resolveSafeAddresses which calls dnsPromises.lookup
		expect(lookupSpy).toHaveBeenCalled();
	});

	it("times out on stuck stream that ignores abort signal (slowloris defense)", async () => {
		vi.useFakeTimers();

		try {
			vi.spyOn(dnsPromises, "lookup").mockImplementation(async () => {
				return lookupAddresses({ address: "93.184.216.34", family: 4 });
			});

			mockedFetch.mockImplementationOnce(async () => {
				// Stream sends one chunk then stalls forever.
				// Crucially does NOT wire abort signal to controller.error() —
				// simulates undici failing to propagate abort to the stream.
				const stream = new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("partial"));
					},
				});

				return new Response(stream, {
					status: 200,
					headers: { "Content-Type": "text/html" },
				});
			});

			const promise = fetchUrl("https://example.com", 100);
			await vi.advanceTimersByTimeAsync(100);

			await expect(promise).rejects.toMatchObject({
				code: "TIMEOUT",
			});
		} finally {
			vi.useRealTimers();
		}
	});
});
