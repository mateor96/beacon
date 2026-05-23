/**
 * Tracks in-flight promises so they can be drained during shutdown.
 * Used to guarantee DLQ writes complete before process exit.
 */
export class PromiseTracker {
	private pending = new Set<Promise<unknown>>();

	/** Track a promise. Returns the same promise for chaining. */
	track<T>(promise: Promise<T>): Promise<T> {
		this.pending.add(promise);
		const cleanup = () => {
			this.pending.delete(promise);
		};
		promise.then(cleanup, cleanup);
		return promise;
	}

	/** Wait for all tracked promises to settle, with a timeout. */
	async waitAll(timeoutMs: number): Promise<{ settled: number; timedOut: boolean }> {
		if (this.pending.size === 0) return { settled: 0, timedOut: false };
		const count = this.pending.size;
		const allSettled = Promise.allSettled([...this.pending]);
		const timeout = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), timeoutMs));
		const result = await Promise.race([allSettled.then(() => "done" as const), timeout]);
		return { settled: count, timedOut: result === "timeout" };
	}

	/** Number of promises currently in-flight. */
	get size(): number {
		return this.pending.size;
	}
}
