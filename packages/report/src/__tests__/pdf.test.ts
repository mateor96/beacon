import { afterEach, describe, expect, it, vi } from "vitest";

// ── Mock puppeteer-core ─────────────────────────────────────
// vi.mock is hoisted — cannot reference top-level variables in factory

vi.mock("puppeteer-core", () => {
	const mockPage = {
		setContent: vi.fn().mockResolvedValue(undefined),
		pdf: vi.fn().mockResolvedValue(Buffer.alloc(60_000)),
		close: vi.fn().mockResolvedValue(undefined),
	};
	const mockBrowser = {
		connected: true,
		newPage: vi.fn().mockResolvedValue(mockPage),
		close: vi.fn().mockResolvedValue(undefined),
	};
	return {
		default: {
			launch: vi.fn().mockResolvedValue(mockBrowser),
			__mockBrowser: mockBrowser,
			__mockPage: mockPage,
		},
	};
});

vi.mock("node:fs", () => ({
	existsSync: vi.fn().mockReturnValue(false),
}));

import puppeteer from "puppeteer-core";
import { closeBrowser, renderPdf } from "../pdf.js";

// Access mock internals
const mocks = puppeteer as unknown as {
	launch: ReturnType<typeof vi.fn>;
	__mockBrowser: {
		connected: boolean;
		newPage: ReturnType<typeof vi.fn>;
		close: ReturnType<typeof vi.fn>;
	};
	__mockPage: {
		setContent: ReturnType<typeof vi.fn>;
		pdf: ReturnType<typeof vi.fn>;
		close: ReturnType<typeof vi.fn>;
	};
};

// ── Tests ───────────────────────────────────────────────────

describe("renderPdf", () => {
	afterEach(async () => {
		await closeBrowser();
		vi.clearAllMocks();
	});

	it("calls page.setContent with the provided HTML", async () => {
		process.env.CHROMIUM_PATH = "/usr/bin/fake-chromium";

		await renderPdf("<html><body>Test</body></html>");

		expect(mocks.__mockPage.setContent).toHaveBeenCalledWith("<html><body>Test</body></html>", {
			waitUntil: "load",
		});

		Reflect.deleteProperty(process.env, "CHROMIUM_PATH");
	});

	it("calls page.pdf with A4 format and margins", async () => {
		process.env.CHROMIUM_PATH = "/usr/bin/fake-chromium";

		await renderPdf("<html>test</html>");

		expect(mocks.__mockPage.pdf).toHaveBeenCalledWith(
			expect.objectContaining({
				format: "A4",
				printBackground: true,
				displayHeaderFooter: true,
			}),
		);

		Reflect.deleteProperty(process.env, "CHROMIUM_PATH");
	});

	it("returns pdf buffer and estimated page count", async () => {
		process.env.CHROMIUM_PATH = "/usr/bin/fake-chromium";

		const result = await renderPdf("<html>test</html>");

		expect(Buffer.isBuffer(result.pdf)).toBe(true);
		// 60_000 bytes / 30_000 per page = 2 pages
		expect(result.pageCount).toBe(2);

		Reflect.deleteProperty(process.env, "CHROMIUM_PATH");
	});

	it("always closes page even if pdf() throws", async () => {
		process.env.CHROMIUM_PATH = "/usr/bin/fake-chromium";
		mocks.__mockPage.pdf.mockRejectedValueOnce(new Error("PDF generation failed"));

		await expect(renderPdf("<html>fail</html>")).rejects.toThrow("PDF generation failed");
		expect(mocks.__mockPage.close).toHaveBeenCalled();

		Reflect.deleteProperty(process.env, "CHROMIUM_PATH");
	});
});

describe("closeBrowser", () => {
	it("closes browser and cleans up singleton", async () => {
		process.env.CHROMIUM_PATH = "/usr/bin/fake-chromium";

		// Trigger browser launch
		await renderPdf("<html>test</html>");
		await closeBrowser();

		expect(mocks.__mockBrowser.close).toHaveBeenCalled();

		Reflect.deleteProperty(process.env, "CHROMIUM_PATH");
	});

	it("is safe to call when no browser exists", async () => {
		// Should not throw
		await closeBrowser();
	});
});
