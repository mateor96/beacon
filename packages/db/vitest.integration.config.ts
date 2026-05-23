import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		include: ["src/**/*.integration.test.ts"],
		testTimeout: 30_000,
		hookTimeout: 30_000,
		// Integration test files share a single Postgres instance and a
		// common set of tables that get TRUNCATEd in `afterEach`. Running
		// them in parallel causes interleaved DML between files and FK
		// violations. Serialize files (tests within a file still run in
		// order) to keep them deterministic.
		fileParallelism: false,
	},
});
