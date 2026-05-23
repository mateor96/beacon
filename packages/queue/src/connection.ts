import type { ConnectionOptions } from "bullmq";
import Redis from "ioredis";

/** Concrete env-derived Redis config — single source of truth. */
export interface RedisBaseOptions {
	host: string;
	port: number;
	password: string;
}

export function getRedisBaseOptions(): RedisBaseOptions {
	const password = process.env.REDIS_PASSWORD;
	if (!password) {
		throw new Error("REDIS_PASSWORD environment variable is required");
	}
	return {
		host: process.env.REDIS_HOST ?? "localhost",
		port: Number(process.env.REDIS_PORT ?? 6379),
		password,
	};
}

export function getConnectionOptions(): ConnectionOptions {
	return {
		...getRedisBaseOptions(),
		maxRetriesPerRequest: null,
		enableReadyCheck: false,
	};
}

export async function pingRedis(): Promise<boolean> {
	const base = getRedisBaseOptions();
	const client = new Redis({
		...base,
		connectTimeout: 2_000,
		maxRetriesPerRequest: 0,
		enableReadyCheck: false,
		enableOfflineQueue: false,
		retryStrategy: () => null,
		lazyConnect: true,
	});

	try {
		await client.connect();
		const result = await client.ping();
		return result === "PONG";
	} catch {
		return false;
	} finally {
		client.disconnect();
	}
}
