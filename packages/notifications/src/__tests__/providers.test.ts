import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsoleProvider } from "../providers/console.js";
import { type EmailProvider, createProvider } from "../providers/index.js";
import { ResendProvider } from "../providers/resend.js";
import type { EmailMessage } from "../providers/types.js";

// ── Helpers ──────────────────────────────────────────────────

function makeMessage(overrides?: Partial<EmailMessage>): EmailMessage {
	return {
		from: "noreply@example.com",
		to: ["user@example.com"],
		subject: "Test Email",
		html: "<p>Hello</p>",
		text: "Hello",
		...overrides,
	};
}

// ── ConsoleProvider ─────────────────────────────────────────

describe("ConsoleProvider", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("send() returns messageId and provider='console'", async () => {
		const provider = new ConsoleProvider();
		const result = await provider.send(makeMessage());

		expect(result.messageId).toBeDefined();
		expect(typeof result.messageId).toBe("string");
		expect(result.messageId.length).toBeGreaterThan(0);
		expect(result.provider).toBe("console");
	});

	it("send() logs to stdout", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const provider = new ConsoleProvider();

		await provider.send(makeMessage({ subject: "Spy Test" }));

		expect(logSpy).toHaveBeenCalled();
		const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
		expect(allOutput).toContain("Spy Test");
		expect(allOutput).toContain("ConsoleProvider");
	});
});

// ── createProvider factory ──────────────────────────────────

describe("createProvider", () => {
	beforeEach(() => {
		// Clear the env var — assigning `undefined` coerces to the string
		// "undefined", so use delete to actually remove it.
		// biome-ignore lint/performance/noDelete: actually unset env var
		delete process.env.RESEND_API_KEY;
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		// biome-ignore lint/performance/noDelete: actually unset env var
		delete process.env.RESEND_API_KEY;
	});

	it("returns ConsoleProvider when RESEND_API_KEY is not set", () => {
		const provider = createProvider();
		expect(provider).toBeInstanceOf(ConsoleProvider);
		expect(provider.name).toBe("console");
	});

	it("returns ResendProvider when RESEND_API_KEY is set", () => {
		vi.stubEnv("RESEND_API_KEY", "re_test_abc123");
		const provider = createProvider();
		expect(provider).toBeInstanceOf(ResendProvider);
		expect(provider.name).toBe("resend");
	});
});

// ── Interface conformance ───────────────────────────────────

describe("EmailProvider interface", () => {
	it("both providers satisfy the EmailProvider interface (duck-type check)", () => {
		const consoleProvider: EmailProvider = new ConsoleProvider();
		expect(typeof consoleProvider.name).toBe("string");
		expect(typeof consoleProvider.send).toBe("function");

		const resendProvider: EmailProvider = new ResendProvider("re_test_key");
		expect(typeof resendProvider.name).toBe("string");
		expect(typeof resendProvider.send).toBe("function");
	});
});
