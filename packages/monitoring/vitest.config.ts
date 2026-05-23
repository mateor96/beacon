import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@beacon/shared": resolve(__dirname, "../shared/src/index.ts"),
			"@beacon/db": resolve(__dirname, "../db/src/index.ts"),
		},
	},
	test: {
		globals: true,
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/__tests__/**", "src/index.ts"],
			thresholds: {
				statements: 90,
				branches: 80,
				functions: 90,
				lines: 90,
			},
		},
	},
});
