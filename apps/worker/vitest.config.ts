import path from "node:path";
import { defineConfig } from "vitest/config";

const packages = path.resolve(__dirname, "../../packages");

export default defineConfig({
	resolve: {
		alias: {
			"@beacon/shared/constants": path.join(packages, "shared/src/constants.ts"),
			"@beacon/shared/types": path.join(packages, "shared/src/types.ts"),
			"@beacon/shared/validation": path.join(packages, "shared/src/validation.ts"),
			"@beacon/shared/crypto-aes-gcm": path.join(packages, "shared/src/crypto-aes-gcm.ts"),
			"@beacon/shared": path.join(packages, "shared/src/index.ts"),
			"@beacon/scanner": path.join(packages, "scanner/src/index.ts"),
			"@beacon/db": path.join(packages, "db/src/index.ts"),
			"@beacon/ai": path.join(packages, "ai/src/index.ts"),
			"@beacon/report": path.join(packages, "report/src/index.ts"),
			"@beacon/monitoring": path.join(packages, "monitoring/src/index.ts"),
			"@beacon/notifications": path.join(packages, "notifications/src/index.ts"),
			"@beacon/queue": path.join(packages, "queue/src/index.ts"),
		},
	},
	test: {
		globals: true,
		env: {
			REDIS_PASSWORD: "test",
			DATABASE_URL: "postgresql://test:test@localhost:5432/test",
		},
	},
});
