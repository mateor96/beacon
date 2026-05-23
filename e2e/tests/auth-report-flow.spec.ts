import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEDED_SCAN_ID = "e2e00000-0000-0000-0000-000000000001";
const AUTH_STATE_PATH = path.join(__dirname, "../.auth/user.json");

test.describe("Authenticated Report Flow", () => {
	test.describe.configure({ mode: "serial" });

	test("login redirects to dashboard with user info", async ({ page, context }) => {
		const testEmail = process.env.E2E_TEST_EMAIL;
		const testPassword = process.env.E2E_TEST_PASSWORD;
		if (!testEmail || !testPassword) {
			throw new Error("E2E_TEST_EMAIL and E2E_TEST_PASSWORD are required");
		}

		await page.goto("/login");

		await page.getByLabel("E-Mail").fill(testEmail);
		await page.getByLabel("Passwort").fill(testPassword);
		await page.getByRole("button", { name: "Anmelden" }).click();

		// Wait for dashboard redirect
		await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

		// Assert user info visible
		await expect(page.getByText(testEmail)).toBeVisible();
		await expect(page.getByText("Starter")).toBeVisible();
		await expect(page.getByRole("button", { name: "Abmelden" })).toBeVisible();

		// Assert seeded scan visible in table
		await expect(page.getByText("example.com")).toBeVisible();

		// Save auth state for subsequent tests
		await context.storageState({ path: AUTH_STATE_PATH });
	});

	test("scan detail shows check results and plan-gated sections", async ({ browser }) => {
		const context = await browser.newContext({ storageState: AUTH_STATE_PATH });
		const page = await context.newPage();

		await page.goto("/dashboard");
		await expect(page.getByText("example.com")).toBeVisible();

		// Click on the seeded scan
		await page.getByText("example.com").click();

		// Wait for scan detail page
		await page.waitForURL(/\/dashboard\/scans\//, { timeout: 10_000 });

		// Assert check results rendered
		await expect(page.getByText("Lesbarkeit")).toBeVisible();

		// Assert PDF report section visible (starter plan allows reports)
		await expect(page.getByRole("button", { name: "Report generieren" })).toBeVisible();

		// Assert AI analysis is gated for starter plan
		await expect(page.getByText(/Upgrade auf/)).toBeVisible();

		await context.close();
	});

	test("generates and downloads PDF report", async ({ browser }) => {
		const context = await browser.newContext({ storageState: AUTH_STATE_PATH });
		const page = await context.newPage();

		// Navigate directly to seeded scan detail
		await page.goto(`/dashboard/scans/${SEEDED_SCAN_ID}`);
		await expect(page.getByRole("button", { name: "Report generieren" })).toBeVisible();

		// Click generate report button
		await page.getByRole("button", { name: "Report generieren" }).click();

		// Assert generation in progress
		await expect(page.getByText(/Report wird gestartet|Report wird generiert/)).toBeVisible();

		// Wait for PDF download link to appear
		// Worker picks up report job, finds pre-seeded reportTexts, skips Claude API, generates PDF
		await expect(page.getByRole("link", { name: "PDF herunterladen" })).toBeVisible({
			timeout: 90_000,
		});

		// Assert report metadata visible
		await expect(page.getByText(/Erstellt am/)).toBeVisible();

		// Assert regenerate button visible
		await expect(page.getByRole("button", { name: "Neu generieren" })).toBeVisible();

		// Click download and verify we get a PDF
		const [download] = await Promise.all([
			page.waitForEvent("download"),
			page.getByRole("link", { name: "PDF herunterladen" }).click(),
		]);

		expect(download.suggestedFilename()).toMatch(/\.pdf$/);

		await context.close();
	});

	test("unauthenticated user is redirected to login", async ({ browser }) => {
		// New context without saved auth state
		const context = await browser.newContext();
		const page = await context.newPage();

		await page.goto("/dashboard");

		// Should redirect to login with next parameter
		await page.waitForURL(/\/login/, { timeout: 10_000 });
		expect(page.url()).toContain("login");

		await context.close();
	});
});
