import type { PlanName } from "@beacon/shared";
import type Redis from "ioredis";
import { NextResponse } from "next/server";

// ── Interfaces ──────────────────────────────────────────────

export interface RateLimitConfig {
	/** Maximum number of requests in the window */
	maxRequests: number;
	/** Window duration in milliseconds */
	windowMs: number;
}

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	limit: number;
	resetAt: number;
}

export type EndpointGroup = "scan" | "mutation" | "status" | "billing" | "public" | "cms";

const RATE_LIMIT_TIERS: Record<
	EndpointGroup,
	{ windowMs: number; limits: Record<PlanName | "anonymous", number> }
> = {
	scan: {
		windowMs: 60_000,
		limits: { anonymous: 5, free: 10, starter: 30, pro: 60, agency: 150, enterprise: 300 },
	},
	mutation: {
		windowMs: 60_000,
		limits: { anonymous: 0, free: 5, starter: 15, pro: 30, agency: 60, enterprise: 150 },
	},
	status: {
		windowMs: 60_000,
		limits: { anonymous: 60, free: 60, starter: 120, pro: 300, agency: 600, enterprise: 1500 },
	},
	billing: {
		windowMs: 60_000,
		limits: { anonymous: 0, free: 5, starter: 5, pro: 5, agency: 5, enterprise: 5 },
	},
	public: {
		windowMs: 60_000,
		limits: { anonymous: 5, free: 5, starter: 5, pro: 5, agency: 5, enterprise: 5 },
	},
	cms: {
		windowMs: 60_000,
		limits: { anonymous: 0, free: 0, starter: 0, pro: 10, agency: 30, enterprise: 60 },
	},
};

export function getRateLimitConfig(
	group: EndpointGroup,
	plan: PlanName | "anonymous" = "anonymous",
): RateLimitConfig {
	const tier = RATE_LIMIT_TIERS[group];
	return { maxRequests: tier.limits[plan], windowMs: tier.windowMs };
}

// ── Redis client (lazy singleton, HMR-safe) ─────────────────

const globalForRateLimit = globalThis as unknown as {
	__awrRateLimitRedis?: Redis;
};

let fallbackLogged = false;

function getRedisClient(): Redis | null {
	if (globalForRateLimit.__awrRateLimitRedis) {
		return globalForRateLimit.__awrRateLimitRedis;
	}

	try {
		const { getRedisBaseOptions } = require("@beacon/queue") as {
			getRedisBaseOptions: () => { host: string; port: number; password: string };
		};
		const baseOptions = getRedisBaseOptions();
		const IoRedis = require("ioredis").default as typeof Redis;

		const client = new IoRedis({
			...baseOptions,
			keyPrefix: "beacon:rl:",
			connectTimeout: 2_000,
			maxRetriesPerRequest: 1,
			enableOfflineQueue: false,
			lazyConnect: true,
		});

		client.on("error", () => {
			// Silently handled — per-call try/catch triggers fallback
		});

		globalForRateLimit.__awrRateLimitRedis = client;
		return client;
	} catch {
		return null;
	}
}

// ── In-memory fallback ──────────────────────────────────────

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const store = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL) return;
	lastCleanup = now;
	for (const [key, entry] of store) {
		if (entry.resetAt < now) store.delete(key);
	}
}

function checkRateLimitMemory(key: string, config: RateLimitConfig): RateLimitResult {
	cleanup();
	const now = Date.now();
	const entry = store.get(key);

	if (!entry || entry.resetAt < now) {
		store.set(key, { count: 1, resetAt: now + config.windowMs });
		return {
			allowed: true,
			remaining: config.maxRequests - 1,
			limit: config.maxRequests,
			resetAt: now + config.windowMs,
		};
	}

	entry.count += 1;
	if (entry.count > config.maxRequests) {
		return { allowed: false, remaining: 0, limit: config.maxRequests, resetAt: entry.resetAt };
	}
	return {
		allowed: true,
		remaining: config.maxRequests - entry.count,
		limit: config.maxRequests,
		resetAt: entry.resetAt,
	};
}

// ── Redis Lua script (sliding-window via sorted sets) ───────

/**
 * Sliding-window rate limiter via atomic Lua script.
 * KEYS[1] = rate limit key
 * ARGV[1] = window duration in milliseconds
 * ARGV[2] = current timestamp in milliseconds
 * ARGV[3] = unique member ID
 * ARGV[4] = max requests allowed
 * Returns: [count, resetMs]
 */
const RATE_LIMIT_LUA = `
local key = KEYS[1]
local windowMs = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local member = ARGV[3]
local maxRequests = tonumber(ARGV[4])
local windowStart = now - windowMs
redis.call("ZREMRANGEBYSCORE", key, "-inf", windowStart)
local count = redis.call("ZCARD", key)
if count < maxRequests then
  redis.call("ZADD", key, now, member)
  redis.call("PEXPIRE", key, windowMs)
  return {count + 1, windowMs}
end
local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
local resetMs = 0
if #oldest >= 2 then
  resetMs = tonumber(oldest[2]) + windowMs - now
  if resetMs < 0 then resetMs = 0 end
end
return {count, resetMs}
`;

async function checkRateLimitRedis(
	redis: Redis,
	key: string,
	config: RateLimitConfig,
): Promise<RateLimitResult> {
	const now = Date.now();
	const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;
	const result = (await redis.eval(
		RATE_LIMIT_LUA,
		1,
		key,
		config.windowMs,
		now,
		member,
		config.maxRequests,
	)) as [number, number];
	const [count, resetMs] = result;

	if (count <= config.maxRequests) {
		return {
			allowed: true,
			remaining: config.maxRequests - count,
			limit: config.maxRequests,
			resetAt: now + config.windowMs,
		};
	}
	return { allowed: false, remaining: 0, limit: config.maxRequests, resetAt: now + resetMs };
}

// ── Public API ──────────────────────────────────────────────

/**
 * Redis-backed rate limiter with in-memory fallback.
 *
 * Uses an atomic Lua script in Redis for distributed rate limiting.
 * Falls back to in-memory when Redis is unavailable (single-instance safety net).
 * Always allows in test mode.
 */
export async function checkRateLimit(
	key: string,
	config: RateLimitConfig,
): Promise<RateLimitResult> {
	if (process.env.NODE_ENV === "test") {
		return {
			allowed: true,
			remaining: config.maxRequests - 1,
			limit: config.maxRequests,
			resetAt: Date.now() + config.windowMs,
		};
	}

	const redis = getRedisClient();
	if (redis) {
		try {
			return await checkRateLimitRedis(redis, key, config);
		} catch {
			if (!fallbackLogged) {
				fallbackLogged = true;
				console.warn("[rate-limit] Redis unavailable, falling back to in-memory limiter");
			}
			return checkRateLimitMemory(key, config);
		}
	}

	return checkRateLimitMemory(key, config);
}

// ── Response helpers ────────────────────────────────────────

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
	return {
		"X-RateLimit-Limit": String(result.limit),
		"X-RateLimit-Remaining": String(result.remaining),
		"X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
	};
}

export function createRateLimitResponse(result: RateLimitResult, message?: string): NextResponse {
	return NextResponse.json(
		{ error: message ?? "Zu viele Anfragen. Bitte warten Sie einen Moment." },
		{
			status: 429,
			headers: {
				...rateLimitHeaders(result),
				"Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
			},
		},
	);
}
