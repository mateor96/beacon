import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isCI = !!process.env.CI;

export default defineConfig({
	testDir: "./tests",
	fullyParallel: false,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	workers: 1,
	timeout: 120_000,
	expect: {
		timeout: 10_000,
	},

	reporter: isCI
		? [["github"], ["html", { open: "never", outputFolder: "playwright-report" }]]
		: [["html", { outputFolder: "playwright-report" }]],

	outputDir: "test-results",

	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	globalSetup: "./global-setup.ts",
	globalTeardown: "./global-teardown.ts",

	webServer: [
		{
			command: "pnpm dev:e2e:web",
			url: "http://localhost:3000",
			reuseExistingServer: !isCI,
			timeout: 60_000,
			cwd: path.resolve(__dirname, ".."),
		},
		{
			command: "pnpm dev:e2e:worker",
			url: "http://localhost:3001/health",
			reuseExistingServer: !isCI,
			timeout: 30_000,
			cwd: path.resolve(__dirname, ".."),
		},
	],
});
