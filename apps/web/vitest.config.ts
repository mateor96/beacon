import path, { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const packages = path.resolve(__dirname, "../../packages");

export default defineConfig({
	resolve: {
		alias: {
			"@": resolve(__dirname, "src"),
			"@beacon/shared/constants": path.join(packages, "shared/src/constants.ts"),
			"@beacon/shared/types": path.join(packages, "shared/src/types.ts"),
			"@beacon/shared/validation": path.join(packages, "shared/src/validation.ts"),
			"@beacon/shared": path.join(packages, "shared/src/index.ts"),
			"@beacon/db": path.join(packages, "db/src/index.ts"),
			"@beacon/monitoring": path.join(packages, "monitoring/src/index.ts"),
			"@beacon/scanner": path.join(packages, "scanner/src/index.ts"),
			"@beacon/queue": path.join(packages, "queue/src/index.ts"),
		},
	},
	test: {
		globals: true,
		env: {
			SCAN_ACCESS_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
		},
	},
});
