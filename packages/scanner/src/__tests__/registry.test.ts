import type { CheckPlugin } from "@beacon/shared";
import { describe, expect, it } from "vitest";
import { CheckRegistry } from "../registry.js";

function makePlugin(overrides: Partial<CheckPlugin> = {}): CheckPlugin {
	return {
		id: "llms-txt",
		name: "llms.txt",
		category: "readability",
		severity: "critical",
		run: async () => ({
			id: "llms-txt",
			name: "llms.txt",
			status: "pass",
			category: "readability",
			severity: "critical",
			score: 100,
			summary: "OK",
			issues: [],
		}),
		...overrides,
	};
}

describe("CheckRegistry immutability", () => {
	it("freezes plugins at registration time", () => {
		const registry = new CheckRegistry();
		registry.register(makePlugin());

		expect(Object.isFrozen(registry.get("llms-txt"))).toBe(true);
	});

	it("get() result rejects property mutation", () => {
		const registry = new CheckRegistry();
		registry.register(makePlugin());
		const plugin = registry.get("llms-txt");
		if (!plugin) throw new Error("expected llms-txt plugin to be registered");

		expect(() => {
			(plugin as unknown as { name: string }).name = "tampered";
		}).toThrow(TypeError);
	});

	it("getAll() returns frozen plugins", () => {
		const registry = new CheckRegistry();
		registry.register(makePlugin());

		for (const plugin of registry.getAll()) {
			expect(Object.isFrozen(plugin)).toBe(true);
		}
	});

	it("getByCategory() returns frozen plugins", () => {
		const registry = new CheckRegistry();
		registry.register(makePlugin({ id: "llms-txt", category: "readability" }));

		for (const plugin of registry.getByCategory("readability")) {
			expect(Object.isFrozen(plugin)).toBe(true);
		}
	});
});

describe("CheckRegistry", () => {
	it("registers and retrieves a plugin", () => {
		const registry = new CheckRegistry();
		const plugin = makePlugin();
		registry.register(plugin);

		expect(registry.get("llms-txt")).toBe(plugin);
		expect(registry.size).toBe(1);
	});

	it("throws on duplicate registration", () => {
		const registry = new CheckRegistry();
		registry.register(makePlugin());

		expect(() => registry.register(makePlugin())).toThrow(
			'Check plugin "llms-txt" is already registered',
		);
	});

	it("returns undefined for unknown id", () => {
		const registry = new CheckRegistry();
		expect(registry.get("llms-txt")).toBeUndefined();
	});

	it("getAll returns all registered plugins", () => {
		const registry = new CheckRegistry();
		const p1 = makePlugin({ id: "llms-txt" });
		const p2 = makePlugin({ id: "robots-txt", name: "robots.txt" });
		registry.register(p1);
		registry.register(p2);

		const all = registry.getAll();
		expect(all).toHaveLength(2);
		expect(all).toContain(p1);
		expect(all).toContain(p2);
	});

	it("getByCategory filters correctly", () => {
		const registry = new CheckRegistry();
		registry.register(makePlugin({ id: "llms-txt", category: "readability" }));
		registry.register(
			makePlugin({
				id: "webmcp",
				name: "WebMCP",
				category: "interactivity",
			}),
		);

		expect(registry.getByCategory("readability")).toHaveLength(1);
		expect(registry.getByCategory("interactivity")).toHaveLength(1);
		expect(registry.getByCategory("transactional")).toHaveLength(0);
	});
});
