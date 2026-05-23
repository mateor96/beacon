import { describe, expect, it } from "vitest";

import { openApiSpec } from "../lib/openapi/spec";

describe("OpenAPI specification", () => {
	it("is valid JSON with required top-level fields", () => {
		// Roundtrip through JSON to verify serializability
		const json = JSON.parse(JSON.stringify(openApiSpec));

		expect(json.openapi).toBe("3.1.0");
		expect(json.info).toBeDefined();
		expect(json.info.title).toBe("Beacon API");
		expect(json.info.version).toBe("1.0.0");
		expect(json.paths).toBeDefined();
		expect(json.components).toBeDefined();
		expect(json.components.securitySchemes).toBeDefined();
		expect(json.components.securitySchemes.bearerAuth).toBeDefined();
		expect(json.tags).toBeDefined();
		expect(Array.isArray(json.tags)).toBe(true);
		expect(json.servers).toBeDefined();
	});

	it("has the expected number of paths (~20 endpoints)", () => {
		const pathKeys = Object.keys(openApiSpec.paths);
		// Count total operations (GET + POST per path)
		let operationCount = 0;
		for (const pathObj of Object.values(openApiSpec.paths)) {
			const methods = pathObj as Record<string, unknown>;
			for (const key of Object.keys(methods)) {
				if (["get", "post", "put", "patch", "delete"].includes(key)) {
					operationCount++;
				}
			}
		}

		// We define ~20 endpoints across ~16 paths
		expect(pathKeys.length).toBeGreaterThanOrEqual(15);
		expect(operationCount).toBeGreaterThanOrEqual(20);
	});

	it("every path has at least one response defined", () => {
		for (const [pathKey, pathObj] of Object.entries(openApiSpec.paths)) {
			const methods = pathObj as Record<string, { responses?: Record<string, unknown> }>;
			for (const [method, operation] of Object.entries(methods)) {
				if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
				const responses = operation.responses;
				expect(responses, `${method.toUpperCase()} ${pathKey} should have responses`).toBeDefined();
				if (!responses) continue;
				expect(
					Object.keys(responses).length,
					`${method.toUpperCase()} ${pathKey} should have at least one response`,
				).toBeGreaterThanOrEqual(1);
			}
		}
	});
});
