import { afterEach, describe, expect, it } from "vitest";
import { getConnectionOptions } from "../connection";

describe("getConnectionOptions", () => {
	const originalEnv = { ...process.env };

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	it("returns correct shape with defaults", () => {
		process.env.REDIS_PASSWORD = "test";
		const opts = getConnectionOptions() as Record<string, unknown>;
		expect(opts.host).toBe("localhost");
		expect(opts.port).toBe(6379);
		expect(opts.password).toBe("test");
	});

	it("returns maxRetriesPerRequest null", () => {
		process.env.REDIS_PASSWORD = "test";
		const opts = getConnectionOptions() as Record<string, unknown>;
		expect(opts.maxRetriesPerRequest).toBeNull();
	});

	it("returns enableReadyCheck false", () => {
		process.env.REDIS_PASSWORD = "test";
		const opts = getConnectionOptions() as Record<string, unknown>;
		expect(opts.enableReadyCheck).toBe(false);
	});

	it("throws when REDIS_PASSWORD missing", () => {
		Reflect.deleteProperty(process.env, "REDIS_PASSWORD");
		expect(() => getConnectionOptions()).toThrow("REDIS_PASSWORD environment variable is required");
	});

	it("respects REDIS_HOST and REDIS_PORT env vars", () => {
		process.env.REDIS_PASSWORD = "test";
		process.env.REDIS_HOST = "redis.example.com";
		process.env.REDIS_PORT = "6380";
		const opts = getConnectionOptions() as Record<string, unknown>;
		expect(opts.host).toBe("redis.example.com");
		expect(opts.port).toBe(6380);
	});
});
