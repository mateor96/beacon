import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPingDb = vi.fn<() => Promise<boolean>>();
const mockPingRedis = vi.fn<() => Promise<boolean>>();

vi.mock("@beacon/db", () => ({ pingDb: mockPingDb }));
vi.mock("@beacon/queue", () => ({ pingRedis: mockPingRedis }));

import { GET } from "../app/api/health/route";

describe("GET /api/health", () => {
	beforeEach(() => {
		mockPingDb.mockReset();
		mockPingRedis.mockReset();
	});

	it("returns 200 ready when DB and Redis are healthy", async () => {
		mockPingDb.mockResolvedValue(true);
		mockPingRedis.mockResolvedValue(true);

		const res = await GET();
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.status).toBe("ready");
		expect(body.service).toBe("web");
		expect(body.checks.db).toBe(true);
		expect(body.checks.redis).toBe(true);
		expect(body.timestamp).toBeDefined();
	});

	it("returns 503 degraded when DB is down", async () => {
		mockPingDb.mockResolvedValue(false);
		mockPingRedis.mockResolvedValue(true);

		const res = await GET();
		expect(res.status).toBe(503);

		const body = await res.json();
		expect(body.status).toBe("degraded");
		expect(body.checks.db).toBe(false);
		expect(body.checks.redis).toBe(true);
	});

	it("returns 503 degraded when Redis is down", async () => {
		mockPingDb.mockResolvedValue(true);
		mockPingRedis.mockResolvedValue(false);

		const res = await GET();
		expect(res.status).toBe(503);

		const body = await res.json();
		expect(body.status).toBe("degraded");
		expect(body.checks.db).toBe(true);
		expect(body.checks.redis).toBe(false);
	});

	it("returns 503 degraded when both are down", async () => {
		mockPingDb.mockResolvedValue(false);
		mockPingRedis.mockResolvedValue(false);

		const res = await GET();
		expect(res.status).toBe(503);

		const body = await res.json();
		expect(body.status).toBe("degraded");
	});

	it("treats import/ping exception as degraded", async () => {
		mockPingDb.mockRejectedValue(new Error("connection refused"));
		mockPingRedis.mockResolvedValue(true);

		const res = await GET();
		expect(res.status).toBe(503);

		const body = await res.json();
		expect(body.checks.db).toBe(false);
	});
});
