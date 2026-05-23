import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		exclude: ["src/**/*.integration.test.ts", "node_modules/**"],
	},
});
