import { expect, test } from "@playwright/test";

test.describe("Anonymous Scan Flow", () => {
	test("submits URL and shows completed scan results", async ({ page }) => {
		await page.goto("/");

		// Scope to Hero section to avoid duplicate ScanForm instances
		const heroSection = page.locator("section").filter({ hasText: "Kostenlos scannen" }).first();

		await heroSection.locator('input[placeholder="z.B. beispiel.de"]').fill("https://example.com");

		await heroSection.getByRole("button", { name: "Kostenlos scannen" }).click();

		// Wait for navigation to results page — URL must include ?access= token
		await page.waitForURL(/\/results\/[0-9a-f-]+\?access=.+/, { timeout: 15_000 });

		// Wait for scan completion (title updates with score)
		// With E2E_STUB_SCAN=true, this resolves in <2s; the pending state is too transient to assert
		await expect(page).toHaveTitle(/Beacon-Score:/, { timeout: 30_000 });

		// Assert readiness level visible
		await expect(page.getByText(/Stufe \d+:/)).toBeVisible();

		// Assert category bars
		await expect(page.getByText("Lesbarkeit")).toBeVisible();
		await expect(page.getByText("Interaktivität")).toBeVisible();
		await expect(page.getByText("Transaktional")).toBeVisible();

		// Assert checks section
		await expect(page.getByText("Checks")).toBeVisible();

		// Assert at least 1 check item exists
		const checkItems = page.locator("details");
		await expect(checkItems.first()).toBeVisible();
	});

	test("shows validation error for empty URL", async ({ page }) => {
		await page.goto("/");

		// Click scan button without filling input
		const heroSection = page.locator("section").filter({ hasText: "Kostenlos scannen" }).first();

		await heroSection.getByRole("button", { name: "Kostenlos scannen" }).click();

		// Assert error region is not empty
		const errorRegion = heroSection.locator('[aria-live="assertive"]');
		await expect(errorRegion).not.toBeEmpty();

		// Assert page URL is still "/"
		expect(page.url()).toMatch(/\/$/);
	});

	test("shows 404 for real scan accessed without token", async ({ page }) => {
		await page.goto("/");

		const heroSection = page.locator("section").filter({ hasText: "Kostenlos scannen" }).first();
		await heroSection.locator('input[placeholder="z.B. beispiel.de"]').fill("https://example.com");
		await heroSection.getByRole("button", { name: "Kostenlos scannen" }).click();

		// Wait for redirect to results page with access token
		await page.waitForURL(/\/results\/[0-9a-f-]+\?access=.+/);

		// Strip the access token and revisit bare URL
		const resultUrl = new URL(page.url());
		resultUrl.searchParams.delete("access");
		await page.goto(resultUrl.pathname);

		await expect(page.getByText("Scan nicht gefunden")).toBeVisible();
	});
});
