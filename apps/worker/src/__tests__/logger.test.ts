import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJobLogger } from "../lib/logger";

describe("createJobLogger", () => {
	let stdoutSpy: ReturnType<typeof vi.spyOn>;
	let stderrSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
		stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const ctx = { queue: "scan", jobId: "job-1", scanId: "scan-1" };

	it("info writes JSON to stdout with correct fields", () => {
		const log = createJobLogger(ctx);
		log.info("test message", { url: "https://example.com" });

		expect(stdoutSpy).toHaveBeenCalledOnce();
		const output = JSON.parse((stdoutSpy.mock.calls[0]?.[0] as string).trim());
		expect(output).toMatchObject({
			level: "info",
			queue: "scan",
			jobId: "job-1",
			scanId: "scan-1",
			message: "test message",
			url: "https://example.com",
		});
		expect(output.ts).toBeTypeOf("number");
	});

	it("warn writes JSON to stdout", () => {
		const log = createJobLogger(ctx);
		log.warn("warning");

		expect(stdoutSpy).toHaveBeenCalledOnce();
		const output = JSON.parse((stdoutSpy.mock.calls[0]?.[0] as string).trim());
		expect(output.level).toBe("warn");
		expect(output.message).toBe("warning");
	});

	it("error writes JSON to stderr with Error details", () => {
		const log = createJobLogger(ctx);
		const err = new Error("boom");
		log.error("something failed", err);

		expect(stderrSpy).toHaveBeenCalledOnce();
		const output = JSON.parse((stderrSpy.mock.calls[0]?.[0] as string).trim());
		expect(output.level).toBe("error");
		expect(output.message).toBe("something failed");
		expect(output.error).toBe("boom");
		expect(output.stack).toContain("Error: boom");
	});

	it("error handles non-Error values", () => {
		const log = createJobLogger(ctx);
		log.error("failed", "string error");

		expect(stderrSpy).toHaveBeenCalledOnce();
		const output = JSON.parse((stderrSpy.mock.calls[0]?.[0] as string).trim());
		expect(output.error).toBe("string error");
		expect(output.stack).toBeUndefined();
	});

	it("error works without error argument", () => {
		const log = createJobLogger(ctx);
		log.error("failed");

		expect(stderrSpy).toHaveBeenCalledOnce();
		const output = JSON.parse((stderrSpy.mock.calls[0]?.[0] as string).trim());
		expect(output.level).toBe("error");
		expect(output.message).toBe("failed");
	});
});
