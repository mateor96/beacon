import { existsSync } from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";
import { renderHtml } from "./template.js";
import type { ReportInput, ReportOutput } from "./types.js";

const SYSTEM_CHROME_PATHS = [
	"/usr/bin/chromium-browser",
	"/usr/bin/chromium",
	"/usr/bin/google-chrome",
	"/usr/bin/google-chrome-stable",
];

function getExecutablePath(): string {
	if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
	if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;

	for (const p of SYSTEM_CHROME_PATHS) {
		if (existsSync(p)) return p;
	}

	throw new Error(
		"No Chromium binary found. Set CHROMIUM_PATH or PUPPETEER_EXECUTABLE_PATH, " +
			"or install Chromium in a standard location.",
	);
}

// ── Singleton browser ──────────────────────────────────────────────

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
	if (browserInstance?.connected) return browserInstance;

	browserInstance = await puppeteer.launch({
		executablePath: getExecutablePath(),
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
	});

	return browserInstance;
}

// ── PDF rendering ──────────────────────────────────────────────────

const FOOTER_TEMPLATE = `
<div style="font-size:9px;width:100%;text-align:center;color:#94a3b8;">
  <span>Seite <span class="pageNumber"></span> von <span class="totalPages"></span></span>
</div>`;

export async function renderPdf(html: string): Promise<{ pdf: Buffer; pageCount: number }> {
	const browser = await getBrowser();
	const page = await browser.newPage();

	try {
		await page.setContent(html, { waitUntil: "load" });

		const pdfData = await page.pdf({
			format: "A4",
			printBackground: true,
			margin: { top: "20mm", bottom: "25mm", left: "15mm", right: "15mm" },
			displayHeaderFooter: true,
			headerTemplate: "<div></div>",
			footerTemplate: FOOTER_TEMPLATE,
		});

		const pdf = Buffer.from(pdfData);
		// Estimate page count from PDF size (avg ~30KB per page)
		const pageCount = Math.max(1, Math.round(pdf.length / 30_000));

		return { pdf, pageCount };
	} finally {
		await page.close();
	}
}

// ── Lifecycle ──────────────────────────────────────────────────────

export async function closeBrowser(): Promise<void> {
	if (browserInstance) {
		await browserInstance.close();
		browserInstance = null;
	}
}

// ── Convenience: full pipeline ─────────────────────────────────────

export async function generateReport(input: ReportInput): Promise<ReportOutput> {
	const html = renderHtml(input);
	const { pdf, pageCount } = await renderPdf(html);

	return {
		html,
		pdf,
		metadata: {
			generatedAt: new Date().toISOString(),
			pageCount,
			fileSizeBytes: pdf.byteLength,
		},
	};
}
