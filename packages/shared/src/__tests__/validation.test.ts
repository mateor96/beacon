import { describe, expect, it } from "vitest";
import {
	CheckIdSchema,
	FixRequestSchema,
	PaginationSchema,
	PlanNameSchema,
	ScanRequestSchema,
	UrlSchema,
	UuidSchema,
} from "../validation";

describe("UrlSchema", () => {
	it("accepts valid HTTPS URL", () => {
		expect(UrlSchema.safeParse("https://example.com").success).toBe(true);
	});

	it("accepts valid HTTP URL", () => {
		expect(UrlSchema.safeParse("http://example.com").success).toBe(true);
	});

	it("auto-prepends https:// for bare domains", () => {
		const result = UrlSchema.safeParse("example.com");
		expect(result.success).toBe(true);
		expect(result.data).toBe("https://example.com");
	});

	it("auto-prepends https:// for www domains", () => {
		const result = UrlSchema.safeParse("www.example.com");
		expect(result.success).toBe(true);
		expect(result.data).toBe("https://www.example.com");
	});

	it("preserves explicit http://", () => {
		const result = UrlSchema.safeParse("http://example.com");
		expect(result.success).toBe(true);
		expect(result.data).toBe("http://example.com");
	});

	it("rejects empty string", () => {
		expect(UrlSchema.safeParse("").success).toBe(false);
	});

	it("rejects nonsense input", () => {
		expect(UrlSchema.safeParse("not a url at all").success).toBe(false);
	});

	it("trims whitespace", () => {
		const result = UrlSchema.safeParse("  https://example.com  ");
		expect(result.success).toBe(true);
		expect(result.data).toBe("https://example.com");
	});

	it("rejects URLs longer than 2048 characters", () => {
		const longUrl = `https://example.com/${"a".repeat(2040)}`;
		expect(UrlSchema.safeParse(longUrl).success).toBe(false);
	});
});

describe("UuidSchema", () => {
	it("accepts valid UUID", () => {
		expect(UuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
	});

	it("rejects garbage", () => {
		expect(UuidSchema.safeParse("not-a-uuid").success).toBe(false);
	});
});

describe("PlanNameSchema", () => {
	it("accepts 'pro'", () => {
		expect(PlanNameSchema.safeParse("pro").success).toBe(true);
	});

	it("rejects 'gold' with German error", () => {
		const result = PlanNameSchema.safeParse("gold");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe("Ungültiger Plan");
		}
	});
});

describe("CheckIdSchema", () => {
	it("accepts 'llms-txt'", () => {
		expect(CheckIdSchema.safeParse("llms-txt").success).toBe(true);
	});

	it("rejects 'unknown'", () => {
		const result = CheckIdSchema.safeParse("unknown");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe("Ungültiger Check");
		}
	});
});

describe("ScanRequestSchema", () => {
	it("accepts valid request", () => {
		expect(ScanRequestSchema.safeParse({ url: "https://example.com" }).success).toBe(true);
	});

	it("rejects missing url", () => {
		expect(ScanRequestSchema.safeParse({}).success).toBe(false);
	});

	it("rejects invalid url", () => {
		expect(ScanRequestSchema.safeParse({ url: "" }).success).toBe(false);
	});

	it("accepts bare domain and normalizes to https", () => {
		const result = ScanRequestSchema.safeParse({ url: "example.com" });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.url).toBe("https://example.com");
		}
	});
});

describe("FixRequestSchema", () => {
	it("accepts valid combo", () => {
		const result = FixRequestSchema.safeParse({
			scanId: "550e8400-e29b-41d4-a716-446655440000",
			checkId: "llms-txt",
		});
		expect(result.success).toBe(true);
	});

	it("rejects invalid UUID", () => {
		const result = FixRequestSchema.safeParse({
			scanId: "bad-uuid",
			checkId: "llms-txt",
		});
		expect(result.success).toBe(false);
	});

	it("rejects invalid checkId", () => {
		const result = FixRequestSchema.safeParse({
			scanId: "550e8400-e29b-41d4-a716-446655440000",
			checkId: "invalid",
		});
		expect(result.success).toBe(false);
	});

	it("rejects valid CheckId that is not a FixGeneratorId", () => {
		const result = FixRequestSchema.safeParse({
			scanId: "550e8400-e29b-41d4-a716-446655440000",
			checkId: "performance",
		});
		expect(result.success).toBe(false);
	});
});

describe("PaginationSchema", () => {
	it("coerces string values", () => {
		const result = PaginationSchema.safeParse({ page: "2", limit: "50" });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.page).toBe(2);
			expect(result.data.limit).toBe(50);
		}
	});

	it("applies defaults", () => {
		const result = PaginationSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.page).toBe(1);
			expect(result.data.limit).toBe(20);
		}
	});

	it("rejects page=0", () => {
		expect(PaginationSchema.safeParse({ page: 0 }).success).toBe(false);
	});

	it("rejects limit=101", () => {
		expect(PaginationSchema.safeParse({ limit: 101 }).success).toBe(false);
	});

	it("rejects limit=0", () => {
		expect(PaginationSchema.safeParse({ limit: 0 }).success).toBe(false);
	});
});
