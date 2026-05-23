import { describe, expect, it, vi } from "vitest";
import {
	NullCrmAdapter,
	ResendCrmAdapter,
	buildLeadPayload,
	resolveCrmAdapter,
} from "../crm/adapter.js";

describe("NullCrmAdapter (#226)", () => {
	it("publishLead resolves without side effects", async () => {
		const adapter = new NullCrmAdapter();
		expect(adapter.id).toBe("null");
		await expect(
			adapter.publishLead({
				email: "x@y.com",
				companyName: null,
				auditUrl: "https://a",
				overallScore: 50,
				utmSource: null,
				utmMedium: null,
				utmCampaign: null,
				capturedAt: new Date().toISOString(),
			}),
		).resolves.toBeUndefined();
	});
});

describe("ResendCrmAdapter (#226)", () => {
	const payload = {
		email: "x@y.com",
		companyName: "Acme",
		auditUrl: "https://example.com",
		overallScore: 80,
		utmSource: "google",
		utmMedium: null,
		utmCampaign: null,
		capturedAt: new Date().toISOString(),
	};

	it("POSTs to /audiences/:id/contacts with the bearer token", async () => {
		const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
		const adapter = new ResendCrmAdapter({
			apiKey: "re_test",
			audienceId: "aud_123",
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		await adapter.publishLead(payload);

		expect(fetchImpl).toHaveBeenCalledTimes(1);
		const [url, init] = fetchImpl.mock.calls[0];
		expect(url).toBe("https://api.resend.com/audiences/aud_123/contacts");
		expect(init.method).toBe("POST");
		expect(init.headers.Authorization).toBe("Bearer re_test");
		const body = JSON.parse(init.body);
		expect(body.email).toBe("x@y.com");
		expect(body.first_name).toBe("Acme");
	});

	it("tolerates 409 Conflict (contact already exists)", async () => {
		const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 409 });
		const adapter = new ResendCrmAdapter({
			apiKey: "re_test",
			audienceId: "aud_123",
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		await expect(adapter.publishLead(payload)).resolves.toBeUndefined();
	});

	it("throws on non-409 errors", async () => {
		const fetchImpl = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			text: async () => "server error",
		});
		const adapter = new ResendCrmAdapter({
			apiKey: "re_test",
			audienceId: "aud_123",
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		await expect(adapter.publishLead(payload)).rejects.toThrow(/Resend CRM error/);
	});
});

describe("resolveCrmAdapter (#226)", () => {
	it("returns NullCrmAdapter when CRM_ADAPTER is unset", () => {
		expect(resolveCrmAdapter({}).id).toBe("null");
	});

	it("returns NullCrmAdapter when resend is selected but keys missing", () => {
		expect(resolveCrmAdapter({ CRM_ADAPTER: "resend" }).id).toBe("null");
	});

	it("returns ResendCrmAdapter when fully configured", () => {
		const adapter = resolveCrmAdapter({
			CRM_ADAPTER: "resend",
			RESEND_API_KEY: "re_x",
			RESEND_AUDIENCE_ID: "aud",
		});
		expect(adapter.id).toBe("resend");
	});
});

describe("buildLeadPayload (#226)", () => {
	it("passes fields through and attaches capturedAt", () => {
		const now = new Date("2026-04-21T12:00:00Z");
		const payload = buildLeadPayload({
			email: "x@y.com",
			companyName: null,
			auditUrl: "https://a",
			overallScore: 42,
			utmSource: "src",
			utmMedium: "em",
			utmCampaign: null,
			capturedAt: now,
		});
		expect(payload.capturedAt).toBe(now.toISOString());
		expect(payload.overallScore).toBe(42);
		expect(payload.utmSource).toBe("src");
	});

	it("defaults capturedAt to now", () => {
		const before = Date.now();
		const payload = buildLeadPayload({
			email: "x@y.com",
			companyName: null,
			auditUrl: "https://a",
			overallScore: 0,
			utmSource: null,
			utmMedium: null,
			utmCampaign: null,
		});
		const ts = new Date(payload.capturedAt).getTime();
		expect(ts).toBeGreaterThanOrEqual(before);
	});
});
