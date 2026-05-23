import { hashIp } from "@/lib/hash-ip";
import { describe, expect, it } from "vitest";

describe("hashIp", () => {
	it("returns consistent hash for same IP", () => {
		const hash1 = hashIp("192.168.1.1");
		const hash2 = hashIp("192.168.1.1");
		expect(hash1).toBe(hash2);
	});

	it("returns different hashes for different IPs", () => {
		const hash1 = hashIp("192.168.1.1");
		const hash2 = hashIp("10.0.0.1");
		expect(hash1).not.toBe(hash2);
	});

	it("returns 64-char hex string", () => {
		const hash = hashIp("192.168.1.1");
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("handles 'unknown' input", () => {
		const hash = hashIp("unknown");
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});
});
