import { describe, expect, it } from "vitest";
import { createTokenBucket } from "../lib/reddit/rate-limiter.js";

describe("createTokenBucket (#212)", () => {
	it("lets the first N requests through instantly when N <= capacity", async () => {
		const bucket = createTokenBucket({
			capacity: 3,
			refillPerSecond: 1,
			now: () => 0,
			sleep: async () => {
				throw new Error("should not sleep");
			},
		});
		await bucket.take();
		await bucket.take();
		await bucket.take();
	});

	it("sleeps when the bucket is empty", async () => {
		const sleeps: number[] = [];
		let t = 0;
		const bucket = createTokenBucket({
			capacity: 1,
			refillPerSecond: 1, // 1 token/sec
			now: () => t,
			sleep: async (ms) => {
				sleeps.push(ms);
				t += ms;
			},
		});
		await bucket.take(); // consumes the initial token
		await bucket.take(); // needs to sleep ~1000ms for the next token
		expect(sleeps.length).toBe(1);
		expect(sleeps[0]).toBeGreaterThanOrEqual(900);
		expect(sleeps[0]).toBeLessThanOrEqual(1100);
	});

	it("refills gradually based on elapsed time", async () => {
		let t = 0;
		const bucket = createTokenBucket({
			capacity: 60,
			refillPerSecond: 1,
			now: () => t,
			sleep: async (ms) => {
				t += ms;
			},
		});
		// consume all 60 tokens instantly
		for (let i = 0; i < 60; i++) await bucket.take();
		// advance time by 5s — should have 5 fresh tokens
		t += 5000;
		for (let i = 0; i < 5; i++) await bucket.take();
		// 6th should need to sleep
		const sleeps: number[] = [];
		const bucket2 = createTokenBucket({
			capacity: 60,
			refillPerSecond: 1,
			now: () => t,
			sleep: async (ms) => {
				sleeps.push(ms);
				t += ms;
			},
		});
		// drain + wait
		for (let i = 0; i < 60; i++) await bucket2.take();
		await bucket2.take();
		expect(sleeps.length).toBe(1);
	});
});
