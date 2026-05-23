/**
 * Simple token-bucket rate limiter for Reddit's 60-req/min ceiling (#180).
 * Not distributed — runs in-process. Deterministic and testable via
 * injected `now()`.
 */
export interface RateLimiter {
	take(): Promise<void>;
}

export function createTokenBucket(opts: {
	capacity: number;
	refillPerSecond: number;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
}): RateLimiter {
	const now = opts.now ?? (() => Date.now());
	const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
	let tokens = opts.capacity;
	let lastRefill = now();

	return {
		async take() {
			// Refill based on elapsed time
			const t = now();
			const elapsedSec = Math.max(0, (t - lastRefill) / 1000);
			tokens = Math.min(opts.capacity, tokens + elapsedSec * opts.refillPerSecond);
			lastRefill = t;

			if (tokens >= 1) {
				tokens -= 1;
				return;
			}
			// Wait for the next token
			const waitMs = Math.ceil(((1 - tokens) / opts.refillPerSecond) * 1000);
			await sleep(waitMs);
			tokens = 0;
			lastRefill = now() + waitMs;
		},
	};
}
