// SSRF protection: Two-layer defense against DNS rebinding
// 1. Pre-fetch DNS validation (assertSafeHostDns) — early-fail defense-in-depth
// 2. Connect-time DNS pinning via undici Agent custom lookup — primary protection
//    Closes the hostname/DNS TOCTOU gap tracked in #196: validated IPs are
//    pinned through the actual TCP connect, preventing rebinding between
//    check and connect. Other SSRF vectors (e.g. egress policy) remain
//    out of scope at the application layer.

import { type LookupAddress, promises as dnsPromises } from "node:dns";
import { isIP } from "node:net";
import { Agent, type Response as UndiciResponse, fetch as undiciFetch } from "undici";

type ConnectorLookupOptions = {
	family?: number | "IPv4" | "IPv6";
	all?: boolean;
	hints?: number;
	verbatim?: boolean;
};

type ConnectorLookupCallback = (
	err: NodeJS.ErrnoException | null,
	address?: string,
	family?: number,
) => void;

function expandIpv6(addr: string): bigint | null {
	const halves = addr.split("::");
	if (halves.length > 2) return null;
	const left = halves[0] ? halves[0].split(":") : [];
	const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
	const missing = 8 - left.length - right.length;
	if (missing < 0) return null;
	const groups = [...left, ...Array(missing).fill("0"), ...right];
	if (groups.length !== 8) return null;
	let result = 0n;
	for (const g of groups) {
		const val = Number.parseInt(g, 16);
		if (Number.isNaN(val) || val < 0 || val > 0xffff) return null;
		result = (result << 16n) | BigInt(val);
	}
	return result;
}

const IPV4_BLOCKED = [
	/^127\./,
	/^10\./,
	/^192\.168\./,
	/^172\.(1[6-9]|2\d|3[01])\./,
	/^0\./,
	/^169\.254\./,
	/^100\.100\.100\.200$/,
];

const IPV6_BLOCKED_CIDRS: Array<{ network: bigint; prefix: number }> = [
	{ network: 1n, prefix: 128 }, // ::1
	{ network: 0n, prefix: 128 }, // ::
	{ network: expandIpv6("fc00::") as bigint, prefix: 7 }, // fc00::/7
	{ network: expandIpv6("fe80::") as bigint, prefix: 10 }, // fe80::/10
	{ network: expandIpv6("fd00:ec2::254") as bigint, prefix: 128 }, // AWS IMDSv2
];

// NOTE: Expects canonical IPv6 (as produced by URL/WHATWG parser or dns.lookup).
// Fully expanded dotted-decimal forms like 0:0:0:0:ffff:0:127.0.0.1 are NOT
// handled — expandIpv6 silently misparsing the dotted group. These forms never
// appear in practice: URL canonicalizes to hex, and dns.lookup returns canonical
// addresses. If you call this helper with raw user input, canonicalize first.
export function isBlockedIp(hostname: string): boolean {
	const ipVersion = isIP(hostname);

	if (ipVersion === 6) {
		// Mixed notation — expandIpv6 silently misparsing dotted decimal
		// (parseInt("127.0.0.1", 16) stops at the dot and returns 295),
		// producing a wrong bigint. Must intercept before expandIpv6.
		// Covers both ::ffff:w.x.y.z (mapped) and ::ffff:0:w.x.y.z (SIIT).
		const mappedMixed = hostname.match(/^::ffff:(?:0:)?(\d+\.\d+\.\d+\.\d+)$/i);
		if (mappedMixed) {
			return IPV4_BLOCKED.some((re) => re.test(mappedMixed[1]));
		}

		const addr = expandIpv6(hostname);
		if (addr === null) return false;

		// IPv4-mapped (::ffff:0:0/96) — covers compressed and expanded forms:
		//   ::ffff:7f00:1, 0:0:0:0:0:ffff:7f00:1
		// IPv4-translatable SIIT (::ffff:0:0:0/96) — URL parser normalizes
		//   ::ffff:0:127.0.0.1 → ::ffff:0:7f00:1 (ffff at bits 63-48, zero at 47-32)
		const extractedIpv4 =
			addr >> 32n === 0xffffn
				? addr & 0xffffffffn
				: addr >> 48n === 0xffffn && ((addr >> 32n) & 0xffffn) === 0n
					? addr & 0xffffffffn
					: null;
		if (extractedIpv4 !== null) {
			const ipv4 = `${Number((extractedIpv4 >> 24n) & 0xffn)}.${Number((extractedIpv4 >> 16n) & 0xffn)}.${Number((extractedIpv4 >> 8n) & 0xffn)}.${Number(extractedIpv4 & 0xffn)}`;
			return IPV4_BLOCKED.some((re) => re.test(ipv4));
		}

		// Standard IPv6 CIDR check
		return IPV6_BLOCKED_CIDRS.some(({ network, prefix }) => {
			const mask = ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - prefix)) - 1n);
			return (addr & mask) === (network & mask);
		});
	}

	if (ipVersion === 4) {
		return IPV4_BLOCKED.some((re) => re.test(hostname));
	}

	// Not an IP literal — checked via hostname blocklist + DNS
	return false;
}

const BLOCKED_HOSTNAMES = [
	"localhost",
	"metadata.google.internal",
	"metadata.azure.internal",
	"169.254.169.254",
];

function normalizeHostname(hostname: string): string {
	return hostname.toLowerCase().replace(/\.$/, "");
}

const DNS_TIMEOUT_MS = 3_000;
const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function sanitizeUrl(url: string): string {
	try {
		const u = new URL(url);
		u.username = "";
		u.password = "";
		return u.toString();
	} catch {
		return "<invalid-url>";
	}
}

function findRootCause(err: Error): Error {
	let current: Error = err;
	for (let i = 0; i < 10; i++) {
		const cause = (current as { cause?: unknown }).cause;
		if (cause instanceof Error) {
			current = cause;
		} else {
			break;
		}
	}
	return current;
}

function isAbortLikeError(err: unknown): boolean {
	const code = (err as NodeJS.ErrnoException | undefined)?.code;

	return (
		(err instanceof DOMException && (err.name === "AbortError" || err.name === "TimeoutError")) ||
		(err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) ||
		code === "ABORT_ERR"
	);
}

export class FetchError extends Error {
	constructor(
		message: string,
		public readonly code:
			| "SSRF_BLOCKED"
			| "UNSAFE_URL"
			| "FETCH_FAILED"
			| "RESPONSE_TOO_LARGE"
			| "TIMEOUT",
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = "FetchError";
	}
}

export interface FetchResult {
	html: string;
	statusCode: number;
	responseTime: number;
	redirects: string[];
	finalUrl: string;
}

export function assertSafeUrl(url: string): void {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new FetchError(`Invalid URL: ${sanitizeUrl(url)}`, "UNSAFE_URL");
	}

	if (!["http:", "https:"].includes(parsed.protocol)) {
		throw new FetchError(`Unsupported protocol: ${parsed.protocol}`, "UNSAFE_URL");
	}

	const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

	const normalized = normalizeHostname(hostname);

	if (BLOCKED_HOSTNAMES.includes(normalized)) {
		throw new FetchError(`Blocked hostname: ${normalized}`, "SSRF_BLOCKED");
	}

	if (isBlockedIp(normalized)) {
		throw new FetchError(`Private IP blocked: ${normalized}`, "SSRF_BLOCKED");
	}
}

/**
 * Reads a response body up to maxBytes, enforcing the caller's AbortSignal
 * as a hard timeout on each chunk read via Promise.race.
 *
 * Defense-in-depth (hardening follow-up to #115): the fetch-level signal
 * already cancels the underlying socket, but some stream implementations
 * may not propagate abort to a pending read() promptly. Racing explicitly
 * guarantees we never block longer than the signal's lifetime, regardless
 * of stream behavior.
 */
async function readBodyWithLimit(
	response: UndiciResponse,
	maxBytes: number,
	url: string,
	signal?: AbortSignal,
): Promise<string> {
	signal?.throwIfAborted();

	const reader = response.body?.getReader();
	if (!reader) {
		return "";
	}

	// Create a one-shot promise that rejects when the signal fires abort.
	// This is raced against each reader.read() to guarantee bounded execution
	// even if the stream implementation does not propagate abort.
	const abortPromise = signal
		? new Promise<never>((_, reject) => {
				if (signal.aborted) {
					reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
					return;
				}
				signal.addEventListener(
					"abort",
					() =>
						reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError")),
					{ once: true },
				);
			})
		: null;

	const chunks: Uint8Array[] = [];
	let totalBytes = 0;

	try {
		for (;;) {
			const { done, value } = abortPromise
				? await Promise.race([reader.read(), abortPromise])
				: await reader.read();

			if (done) break;

			totalBytes += value.byteLength;
			if (totalBytes > maxBytes) {
				await reader.cancel();
				throw new FetchError(
					`Response body exceeds ${maxBytes} bytes for ${sanitizeUrl(url)}`,
					"RESPONSE_TOO_LARGE",
				);
			}
			chunks.push(value);
		}
	} catch (err) {
		await reader.cancel().catch(() => {});
		if (err instanceof FetchError) throw err;
		if (isAbortLikeError(err)) {
			throw err;
		}
		if (signal?.aborted) {
			throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
		}
		throw err;
	}

	// Defuse abort promise: signal may fire after body was fully read,
	// which would cause an unhandled rejection. Swallow it safely.
	abortPromise?.catch(() => {});

	return new TextDecoder().decode(Buffer.concat(chunks));
}

/**
 * Resolves hostname via DNS and validates all returned addresses.
 * Returns the validated address list, or throws FetchError.
 * Empty array means ENOTFOUND/ENODATA (host does not exist).
 */
async function resolveSafeAddresses(
	hostname: string,
	remainingMs: number,
): Promise<LookupAddress[]> {
	const normalized = normalizeHostname(hostname);

	if (BLOCKED_HOSTNAMES.includes(normalized)) {
		throw new FetchError(`Blocked hostname: ${normalized}`, "SSRF_BLOCKED");
	}

	const dnsTimeout = Math.floor(Math.min(DNS_TIMEOUT_MS, remainingMs));

	let results: LookupAddress[];
	try {
		results = await dnsPromises.lookup(normalized, {
			all: true,
			verbatim: true,
			signal: AbortSignal.timeout(dnsTimeout),
		} as { all: true; verbatim: true });
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		if (code === "ENOTFOUND" || code === "ENODATA") return [];

		if (isAbortLikeError(err)) {
			throw new FetchError(`DNS lookup timed out for ${normalized}`, "TIMEOUT", {
				cause: err instanceof Error ? err : undefined,
			});
		}

		throw new FetchError(
			`DNS lookup failed for ${normalized}: ${code ?? "unknown"}`,
			"FETCH_FAILED",
			{ cause: err instanceof Error ? err : undefined },
		);
	}

	for (const { address } of results) {
		if (isBlockedIp(address)) {
			throw new FetchError(
				`DNS resolved to blocked IP: ${address} for ${normalized}`,
				"SSRF_BLOCKED",
			);
		}
	}

	return results;
}

async function assertSafeHostDns(hostname: string, remainingMs: number): Promise<void> {
	if (isIP(hostname) !== 0) return;
	await resolveSafeAddresses(hostname, remainingMs);
}

function createSsrfSafeLookup(remainingMs: number) {
	return (hostname: string, options: ConnectorLookupOptions, callback: ConnectorLookupCallback) => {
		// IP literals: validate directly, return as-is
		if (isIP(hostname) !== 0) {
			if (isBlockedIp(hostname)) {
				callback(new FetchError(`Private IP blocked: ${hostname}`, "SSRF_BLOCKED"));
				return;
			}
			const family = isIP(hostname); // 4 or 6
			callback(null, hostname, family);
			return;
		}

		resolveSafeAddresses(hostname, remainingMs)
			.then((results) => {
				if (results.length === 0) {
					if (options.all) {
						callback(null, [] as never);
						return;
					}
					const err = Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), {
						code: "ENOTFOUND",
					});
					callback(err);
					return;
				}

				// Honor family preference from connector options
				const familyNum =
					options.family === "IPv4" ? 4 : options.family === "IPv6" ? 6 : options.family;
				const preferred = familyNum ? results.filter((r) => r.family === familyNum) : results;

				// undici passes all:true — return array of {address, family}
				if (options.all) {
					const validated = preferred.length > 0 ? preferred : results;
					callback(null, validated.map((r) => ({ address: r.address, family: r.family })) as never);
					return;
				}

				const selected = preferred.length > 0 ? preferred[0] : results[0];
				callback(null, selected.address, selected.family);
			})
			.catch((err) => callback(err instanceof Error ? err : new Error(String(err))));
	};
}

function unwrapFetchError(error: unknown): FetchError | null {
	let current = error;
	const seen = new Set();
	while (current != null && !seen.has(current)) {
		if (current instanceof FetchError) return current;
		seen.add(current);
		current =
			typeof current === "object" && current !== null && "cause" in current
				? (current as { cause?: unknown }).cause
				: undefined;
	}
	return null;
}

export async function fetchUrl(url: string, timeoutMs = 15_000): Promise<FetchResult> {
	assertSafeUrl(url);

	const redirects: string[] = [];
	const start = performance.now();
	const deadline = start + timeoutMs;
	let currentUrl = url;
	const visited = new Set<string>([new URL(url).toString()]);

	try {
		// Follow redirects manually to validate each hop against SSRF
		for (let i = 0; i < MAX_REDIRECTS + 1; i++) {
			const remainingMs = deadline - performance.now();
			if (remainingMs <= 0) {
				throw new FetchError(
					`Fetch timed out after ${timeoutMs}ms for ${sanitizeUrl(url)}`,
					"TIMEOUT",
				);
			}

			const currentHostname = new URL(currentUrl).hostname.replace(/^\[|\]$/g, "");
			await assertSafeHostDns(currentHostname, remainingMs);

			const hopSignal = AbortSignal.timeout(Math.max(Math.floor(deadline - performance.now()), 0));

			// Per-hop Agent with SSRF-safe DNS pinning — never shared across hops
			const agent = new Agent({
				connect: { lookup: createSsrfSafeLookup(remainingMs) as never },
				connections: 1,
			});

			let response: UndiciResponse;
			try {
				response = await undiciFetch(currentUrl, {
					signal: hopSignal,
					headers: {
						"User-Agent": "BeaconBot/1.0",
					},
					redirect: "manual",
					dispatcher: agent,
				});
			} finally {
				await agent.close();
			}

			if (REDIRECT_STATUSES.has(response.status)) {
				await response.body?.cancel();

				const location = response.headers.get("location");
				if (!location) {
					throw new FetchError(
						`Redirect ${response.status} without Location header at ${sanitizeUrl(currentUrl)}`,
						"FETCH_FAILED",
					);
				}

				// Resolve relative redirect URLs against current URL
				const resolved = new URL(location, currentUrl);
				resolved.hash = "";
				const nextUrl = resolved.toString();

				// Block dangerous schemes in redirect targets
				assertSafeUrl(nextUrl);

				// Detect redirect loops
				if (visited.has(nextUrl)) {
					throw new FetchError(`Redirect loop detected for ${sanitizeUrl(url)}`, "FETCH_FAILED");
				}
				visited.add(nextUrl);

				redirects.push(nextUrl);
				currentUrl = nextUrl;

				// Check if we've exhausted our redirect budget
				if (redirects.length >= MAX_REDIRECTS) {
					throw new FetchError(
						`Too many redirects (max ${MAX_REDIRECTS}) for ${sanitizeUrl(url)}`,
						"FETCH_FAILED",
					);
				}

				continue;
			}

			// Non-redirect response: safe to read the body
			const contentLength = response.headers.get("content-length");
			const size = Number(contentLength);
			if (!Number.isNaN(size) && size > MAX_RESPONSE_BYTES) {
				await response.body?.cancel();
				throw new FetchError(
					`Response too large (${contentLength} bytes, max ${MAX_RESPONSE_BYTES}) for ${sanitizeUrl(url)}`,
					"RESPONSE_TOO_LARGE",
				);
			}

			const html = await readBodyWithLimit(response, MAX_RESPONSE_BYTES, url, hopSignal);
			const responseTime = Math.round(performance.now() - start);

			return {
				html,
				statusCode: response.status,
				responseTime,
				redirects,
				finalUrl: currentUrl,
			};
		}

		// Safety net: should never be reached
		throw new FetchError(
			`Too many redirects (max ${MAX_REDIRECTS}) for ${sanitizeUrl(url)}`,
			"FETCH_FAILED",
		);
	} catch (error) {
		if (error instanceof FetchError) throw error;

		const wrapped = unwrapFetchError(error);
		if (wrapped) throw wrapped;

		if (isAbortLikeError(error)) {
			throw new FetchError(
				`Fetch timed out after ${timeoutMs}ms for ${sanitizeUrl(url)}`,
				"TIMEOUT",
				{ cause: error instanceof Error ? error : undefined },
			);
		}

		// Detect SSL/TLS errors from the cause chain
		const rootCause = error instanceof Error ? findRootCause(error) : null;
		const rootMsg = rootCause?.message ?? "";
		if (
			rootMsg.includes("CERT") ||
			rootMsg.includes("certificate") ||
			rootMsg.includes("SSL") ||
			rootMsg.includes("TLS") ||
			rootMsg.includes("self-signed") ||
			rootMsg.includes("unable to verify")
		) {
			throw new FetchError(
				`SSL-Zertifikat ungültig für ${sanitizeUrl(url)} — die Website hat ein abgelaufenes oder fehlerhaftes Zertifikat`,
				"FETCH_FAILED",
				{ cause: error },
			);
		}

		// Detect DNS resolution failures
		if (rootMsg.includes("ENOTFOUND") || rootMsg.includes("getaddrinfo")) {
			throw new FetchError(
				`Domain nicht gefunden: ${sanitizeUrl(url)} — prüfen Sie die URL auf Tippfehler`,
				"FETCH_FAILED",
				{ cause: error },
			);
		}

		// Detect connection refused
		if (rootMsg.includes("ECONNREFUSED") || rootMsg.includes("ECONNRESET")) {
			throw new FetchError(
				`Verbindung abgelehnt für ${sanitizeUrl(url)} — der Server ist nicht erreichbar`,
				"FETCH_FAILED",
				{ cause: error },
			);
		}

		const message = error instanceof Error ? error.message : "Unknown fetch error";
		throw new FetchError(
			`Fetch fehlgeschlagen für ${sanitizeUrl(url)}: ${message}`,
			"FETCH_FAILED",
			{
				cause: error,
			},
		);
	}
}
