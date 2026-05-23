import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Set test secret before importing module
const TEST_SECRET = "a".repeat(64);

beforeEach(() => {
	vi.stubEnv("SCAN_ACCESS_SECRET", TEST_SECRET);
	vi.stubEnv("SCAN_ACCESS_LEGACY_CUTOFF", "2026-04-01T00:00:00Z");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

const { mintAccessToken, verifyAccessToken, getScanAccess, normalizeAccessToken } = await import(
	"@/lib/scan-access"
);

describe("mintAccessToken", () => {
	it("produces a two-part payload.signature string", () => {
		const token = mintAccessToken("scan-1", new Date("2099-01-01T00:00:00Z"));
		expect(token).toContain(".");
		const parts = token.split(".");
		expect(parts).toHaveLength(2);
		expect(parts[0]?.length).toBeGreaterThan(0);
		expect(parts[1]?.length).toBeGreaterThan(0);
	});
});

describe("verifyAccessToken", () => {
	const SCAN_ID = "scan-123";
	const EXPIRES_AT = new Date("2099-06-01T00:00:00Z");

	it("accepts valid token for correct scanId + matching expiresAt", () => {
		const token = mintAccessToken(SCAN_ID, EXPIRES_AT);
		expect(verifyAccessToken(token, SCAN_ID, EXPIRES_AT)).toBe(true);
	});

	it("rejects wrong scanId", () => {
		const token = mintAccessToken(SCAN_ID, EXPIRES_AT);
		expect(verifyAccessToken(token, "wrong-id", EXPIRES_AT)).toBe(false);
	});

	it("rejects token when scan expiresAt changed", () => {
		const token = mintAccessToken(SCAN_ID, EXPIRES_AT);
		const newExpiry = new Date("2099-12-01T00:00:00Z");
		expect(verifyAccessToken(token, SCAN_ID, newExpiry)).toBe(false);
	});

	it("rejects wall-clock expired token", () => {
		const pastDate = new Date("2020-01-01T00:00:00Z");
		const token = mintAccessToken(SCAN_ID, pastDate);
		expect(verifyAccessToken(token, SCAN_ID, pastDate)).toBe(false);
	});

	it("rejects tampered signature", () => {
		const token = mintAccessToken(SCAN_ID, EXPIRES_AT);
		const [payload] = token.split(".");
		const tampered = `${payload}.AAAA_tampered_sig`;
		expect(verifyAccessToken(tampered, SCAN_ID, EXPIRES_AT)).toBe(false);
	});

	it("rejects empty string", () => {
		expect(verifyAccessToken("", SCAN_ID, EXPIRES_AT)).toBe(false);
	});

	it("rejects token without dot", () => {
		expect(verifyAccessToken("nodot", SCAN_ID, EXPIRES_AT)).toBe(false);
	});

	it("returns false for non-string input", () => {
		expect(verifyAccessToken(["a", "b"], SCAN_ID, EXPIRES_AT)).toBe(false);
		expect(verifyAccessToken(42, SCAN_ID, EXPIRES_AT)).toBe(false);
		expect(verifyAccessToken(null, SCAN_ID, EXPIRES_AT)).toBe(false);
	});
});

describe("getScanAccess", () => {
	const SCAN_ID = "scan-abc";
	const USER_ID = "user-1";
	const FUTURE = new Date("2099-01-01T00:00:00Z");
	const SCANNED_AT = new Date("2026-03-16T10:00:00Z");

	it('returns "owner" when viewerUserId matches scan.userId', () => {
		const result = getScanAccess(
			{ userId: USER_ID, id: SCAN_ID, expiresAt: FUTURE, scannedAt: SCANNED_AT },
			{ viewerUserId: USER_ID },
		);
		expect(result).toBe("owner");
	});

	it('returns "token" for valid access token', () => {
		const token = mintAccessToken(SCAN_ID, FUTURE);
		const result = getScanAccess(
			{ userId: null, id: SCAN_ID, expiresAt: FUTURE, scannedAt: SCANNED_AT },
			{ accessToken: token },
		);
		expect(result).toBe("token");
	});

	it("legacy anonymous scan (before cutoff) without token returns token", () => {
		const result = getScanAccess(
			{
				userId: null,
				id: SCAN_ID,
				expiresAt: FUTURE,
				scannedAt: new Date("2026-03-15"),
			},
			{},
		);
		expect(result).toBe("token");
	});

	it("post-cutoff anonymous scan without token returns null", () => {
		const result = getScanAccess(
			{
				userId: null,
				id: SCAN_ID,
				expiresAt: FUTURE,
				scannedAt: new Date("2026-05-01"),
			},
			{},
		);
		expect(result).toBeNull();
	});

	it("legacy anonymous scan works even when viewer is logged in", () => {
		const result = getScanAccess(
			{
				userId: null,
				id: SCAN_ID,
				expiresAt: FUTURE,
				scannedAt: new Date("2026-03-15"),
			},
			{ viewerUserId: "some-user" },
		);
		expect(result).toBe("token");
	});

	it("invalid SCAN_ACCESS_LEGACY_CUTOFF disables fallback", () => {
		vi.stubEnv("SCAN_ACCESS_LEGACY_CUTOFF", "not-a-date");
		const result = getScanAccess(
			{
				userId: null,
				id: SCAN_ID,
				expiresAt: FUTURE,
				scannedAt: new Date("2026-03-15"),
			},
			{},
		);
		expect(result).toBeNull();
	});

	it("returns null for expired scan even for owner", () => {
		const past = new Date("2020-01-01T00:00:00Z");
		const result = getScanAccess(
			{ userId: USER_ID, id: SCAN_ID, expiresAt: past, scannedAt: SCANNED_AT },
			{ viewerUserId: USER_ID },
		);
		expect(result).toBeNull();
	});

	it("returns null when viewerUserId does not match scan.userId", () => {
		const result = getScanAccess(
			{ userId: USER_ID, id: SCAN_ID, expiresAt: FUTURE, scannedAt: SCANNED_AT },
			{ viewerUserId: "other-user" },
		);
		expect(result).toBeNull();
	});
});

describe("normalizeAccessToken", () => {
	it("returns string as-is", () => {
		expect(normalizeAccessToken("valid-token")).toBe("valid-token");
	});

	it("returns undefined for array (duplicate params)", () => {
		expect(normalizeAccessToken(["a", "b"])).toBeUndefined();
	});

	it("returns undefined for null", () => {
		expect(normalizeAccessToken(null)).toBeUndefined();
	});

	it("returns undefined for undefined", () => {
		expect(normalizeAccessToken(undefined)).toBeUndefined();
	});
});
