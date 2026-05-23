import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@beacon/shared/constants": resolve(__dirname, "../shared/src/constants.ts"),
			"@beacon/shared/types": resolve(__dirname, "../shared/src/types.ts"),
			"@beacon/shared": resolve(__dirname, "../shared/src/index.ts"),
		},
	},
	test: {
		globals: true,
	},
});
