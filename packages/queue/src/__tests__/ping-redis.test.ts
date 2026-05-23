import Redis from "ioredis";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConnect = vi.fn();
const mockPing = vi.fn();
const mockDisconnect = vi.fn();

vi.mock("ioredis", () => ({
	default: vi.fn().mockImplementation(() => ({
		connect: mockConnect,
		ping: mockPing,
		disconnect: mockDisconnect,
	})),
}));

import { pingRedis } from "../connection";

describe("pingRedis", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns true on successful PONG", async () => {
		process.env.REDIS_PASSWORD = "test";
		mockConnect.mockResolvedValue(undefined);
		mockPing.mockResolvedValue("PONG");

		const result = await pingRedis();

		expect(result).toBe(true);
		expect(mockConnect).toHaveBeenCalledTimes(1);
		expect(mockPing).toHaveBeenCalledTimes(1);
		expect(mockDisconnect).toHaveBeenCalledTimes(1);
	});

	it("returns false on connection failure", async () => {
		process.env.REDIS_PASSWORD = "test";
		mockConnect.mockRejectedValue(new Error("ECONNREFUSED"));

		const result = await pingRedis();

		expect(result).toBe(false);
		expect(mockDisconnect).toHaveBeenCalledTimes(1);
	});

	it("returns false on ping failure and still disconnects", async () => {
		process.env.REDIS_PASSWORD = "test";
		mockConnect.mockResolvedValue(undefined);
		mockPing.mockRejectedValue(new Error("timeout"));

		const result = await pingRedis();

		expect(result).toBe(false);
		expect(mockDisconnect).toHaveBeenCalledTimes(1);
	});

	it("creates ioredis client with one-shot probe options", async () => {
		process.env.REDIS_PASSWORD = "test";
		mockConnect.mockResolvedValue(undefined);
		mockPing.mockResolvedValue("PONG");

		await pingRedis();

		const ctorCall = (Redis as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
		expect(ctorCall).toMatchObject({
			connectTimeout: 2_000,
			maxRetriesPerRequest: 0,
			enableReadyCheck: false,
			enableOfflineQueue: false,
			lazyConnect: true,
		});
		expect(ctorCall.retryStrategy()).toBeNull();
	});
});
