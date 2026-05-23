import path from "node:path";
import { defineConfig } from "vitest/config";

const packages = path.resolve(__dirname, "../../packages");

export default defineConfig({
	resolve: {
		alias: {
			"@beacon/shared/constants": path.join(packages, "shared/src/constants.ts"),
			"@beacon/shared/types": path.join(packages, "shared/src/types.ts"),
			"@beacon/shared": path.join(packages, "shared/src/index.ts"),
		},
	},
	test: {
		globals: true,
		env: { REDIS_PASSWORD: "test" },
		typecheck: {
			enabled: true,
			include: ["src/__tests__/*.test-d.ts"],
		},
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/__tests__/**", "src/index.ts"],
			thresholds: {
				statements: 80,
				branches: 75,
				functions: 80,
				lines: 80,
			},
		},
	},
});
