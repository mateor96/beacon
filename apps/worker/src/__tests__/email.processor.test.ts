import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted to avoid TDZ issues) ─────────────────────

const { mockProviderSend, mockUpdateEmailLogStatus } = vi.hoisted(() => ({
	mockProviderSend: vi.fn(),
	mockUpdateEmailLogStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@beacon/notifications", () => ({
	createProvider: () => ({
		name: "console",
		send: (...args: unknown[]) => mockProviderSend(...args),
	}),
}));

vi.mock("@beacon/db", () => ({
	db: {},
	emailQueries: {
		updateEmailLogStatus: (...args: unknown[]) => mockUpdateEmailLogStatus(...args),
	},
}));

import { processEmail } from "../processors/email.processor.js";

// ── Helpers ──────────────────────────────────────────────────

function makeJob(data: {
	emailLogId: string;
	to: string[];
	from: string;
	subject: string;
	html: string;
	text: string;
	headers?: Record<string, string>;
	tags?: string[];
}) {
	return {
		id: "test-job-1",
		data,
		opts: { attempts: 3 },
		attemptsMade: 0,
		updateProgress: vi.fn(),
		log: vi.fn(),
	} as Parameters<typeof processEmail>[0];
}

const defaultJobData = {
	emailLogId: "log-1",
	to: ["user@example.com"],
	from: "noreply@example.com",
	subject: "Test Email",
	html: "<p>Hello</p>",
	text: "Hello",
};

// ── Tests ────────────────────────────────────────────────────

describe("processEmail", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockProviderSend.mockResolvedValue({
			messageId: "msg-abc-123",
			provider: "console",
		});
	});

	it("sends via provider and updates log to 'sent'", async () => {
		await processEmail(makeJob(defaultJobData));

		expect(mockProviderSend).toHaveBeenCalledWith(
			expect.objectContaining({
				to: ["user@example.com"],
				subject: "Test Email",
			}),
		);

		expect(mockUpdateEmailLogStatus).toHaveBeenCalledWith(
			expect.anything(),
			"log-1",
			expect.objectContaining({
				status: "sent",
				providerMessageId: "msg-abc-123",
			}),
		);
	});

	it("returns providerMessageId", async () => {
		const result = await processEmail(makeJob(defaultJobData));

		expect(result).toEqual(
			expect.objectContaining({
				emailLogId: "log-1",
				providerMessageId: "msg-abc-123",
			}),
		);
	});

	it("handles provider error (throws for BullMQ retry)", async () => {
		mockProviderSend.mockRejectedValue(new Error("Resend API error: rate limited"));

		await expect(processEmail(makeJob(defaultJobData))).rejects.toThrow("rate limited");
	});

	it("does not update email_log on provider error (BullMQ handles retries)", async () => {
		mockProviderSend.mockRejectedValue(new Error("Provider timeout"));

		await expect(processEmail(makeJob(defaultJobData))).rejects.toThrow("Provider timeout");

		// The error propagates before DB update — BullMQ will retry the job
		expect(mockUpdateEmailLogStatus).not.toHaveBeenCalled();
	});

	it("uses correct log context (queue: 'email')", async () => {
		const job = makeJob(defaultJobData);
		await processEmail(job);

		// The processor correctly processes email queue data
		expect(mockProviderSend).toHaveBeenCalledTimes(1);
		expect(mockUpdateEmailLogStatus).toHaveBeenCalledTimes(1);

		// The result references the correct email log ID
		const result = await processEmail(makeJob({ ...defaultJobData, emailLogId: "log-email-ctx" }));
		expect(result.emailLogId).toBe("log-email-ctx");
	});
});
