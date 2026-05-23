import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted to avoid TDZ issues) ─────────────────────

const {
	mockAddJob,
	mockInsertEmailLog,
	mockGetEmailLogByIdempotencyKey,
	mockGetUserEmailPreference,
} = vi.hoisted(() => ({
	mockAddJob: vi.fn().mockResolvedValue({ id: "job-1" }),
	mockInsertEmailLog: vi.fn().mockResolvedValue({ id: "log-1" }),
	mockGetEmailLogByIdempotencyKey: vi.fn().mockResolvedValue(null),
	mockGetUserEmailPreference: vi.fn().mockResolvedValue(null),
}));

vi.mock("@beacon/queue", () => ({
	addJob: (...args: unknown[]) => mockAddJob(...args),
}));

vi.mock("@beacon/db", () => ({
	db: {},
	emailQueries: {
		insertEmailLog: (...args: unknown[]) => mockInsertEmailLog(...args),
		getEmailLogByIdempotencyKey: (...args: unknown[]) => mockGetEmailLogByIdempotencyKey(...args),
		getUserEmailPreference: (...args: unknown[]) => mockGetUserEmailPreference(...args),
	},
}));

import type { EmailProvider } from "../providers/types.js";
import { EmailService, type EmailServiceConfig } from "../service/email-service.js";

// ── Helpers ──────────────────────────────────────────────────

const stubProvider: EmailProvider = {
	name: "stub",
	async send() {
		return { providerMessageId: "stub-1" };
	},
};

function createService(overrides: Partial<EmailServiceConfig> = {}) {
	return new EmailService({
		provider: stubProvider,
		defaultFrom: "noreply@example.com",
		unsubscribeSecret: "test-secret",
		appBaseUrl: "https://example.com",
		...overrides,
	});
}

const baseSendArgs = {
	to: "user@example.com",
	userId: "user-42",
	template: "scan-complete" as const,
	data: {
		scanId: "scan-1",
		url: "https://example.com",
		score: 85,
		reportUrl: "https://example.com/reports/scan-1",
	},
};

// ── Tests ────────────────────────────────────────────────────

describe("EmailService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", "test-secret");
		mockGetEmailLogByIdempotencyKey.mockResolvedValue(null);
		mockGetUserEmailPreference.mockResolvedValue(null);
		mockInsertEmailLog.mockResolvedValue({ id: "log-1" });
	});

	it("send() renders template and enqueues job", async () => {
		const service = createService();
		const result = await service.send(baseSendArgs);

		expect(result.status).not.toBe("deduplicated");
		expect(mockAddJob).toHaveBeenCalledWith(
			"email",
			expect.objectContaining({
				to: ["user@example.com"],
				subject: expect.any(String),
				html: expect.any(String),
			}),
			expect.any(Object),
		);
	});

	it("send() inserts email_log with status 'queued'", async () => {
		const service = createService();
		await service.send(baseSendArgs);

		expect(mockInsertEmailLog).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				status: "queued",
			}),
		);
	});

	it("send() with idempotencyKey that exists returns 'deduplicated'", async () => {
		mockGetEmailLogByIdempotencyKey.mockResolvedValueOnce({ id: "existing-log" });

		const service = createService();
		const result = await service.send({
			...baseSendArgs,
			idempotencyKey: "idem-key-1",
		});

		expect(result.status).toBe("deduplicated");
		expect(mockAddJob).not.toHaveBeenCalled();
	});

	it("send() with unsubscribed user returns 'suppressed'", async () => {
		mockGetUserEmailPreference.mockResolvedValueOnce({ enabled: false });

		const service = createService();
		const result = await service.send({
			...baseSendArgs,
			category: "marketing",
		});

		expect(result.status).toBe("suppressed");
		expect(mockAddJob).not.toHaveBeenCalled();
	});

	it("send() with category 'transactional' skips preference check", async () => {
		const service = createService();
		const result = await service.send({
			...baseSendArgs,
			category: "transactional",
		});

		expect(result.status).not.toBe("suppressed");
		expect(mockGetUserEmailPreference).not.toHaveBeenCalled();
		expect(mockAddJob).toHaveBeenCalled();
	});

	it("send() with scheduledAt adds delay to BullMQ job", async () => {
		const futureDate = new Date(Date.now() + 60_000);

		const service = createService();
		await service.send({
			...baseSendArgs,
			scheduledAt: futureDate,
		});

		expect(mockAddJob).toHaveBeenCalledWith(
			"email",
			expect.any(Object),
			expect.objectContaining({
				delay: expect.any(Number),
			}),
		);

		const opts = mockAddJob.mock.calls[0]?.[2];
		expect(opts.delay).toBeGreaterThan(0);
	});

	it("send() normalizes single email to array", async () => {
		const service = createService();
		await service.send({
			...baseSendArgs,
			to: "single@example.com",
		});

		expect(mockAddJob).toHaveBeenCalledWith(
			"email",
			expect.objectContaining({
				to: ["single@example.com"],
			}),
			expect.any(Object),
		);
	});

	it("send() generates unsubscribe URL for non-transactional emails", async () => {
		const service = createService();
		await service.send({
			...baseSendArgs,
			category: "marketing",
		});

		expect(mockAddJob).toHaveBeenCalledWith(
			"email",
			expect.objectContaining({
				headers: expect.objectContaining({
					"List-Unsubscribe": expect.any(String),
				}),
			}),
			expect.any(Object),
		);
	});

	it("send() uses idempotencyKey as BullMQ jobId", async () => {
		const service = createService();
		await service.send({
			...baseSendArgs,
			idempotencyKey: "unique-key-42",
		});

		expect(mockAddJob).toHaveBeenCalledWith(
			"email",
			expect.any(Object),
			expect.objectContaining({
				jobId: "unique-key-42",
			}),
		);
	});

	it("send() with unknown template throws", async () => {
		const service = createService();

		await expect(
			service.send({
				...baseSendArgs,
				// @ts-expect-error intentionally passing invalid template name
				template: "nonexistent-template",
			}),
		).rejects.toThrow();
	});
});
