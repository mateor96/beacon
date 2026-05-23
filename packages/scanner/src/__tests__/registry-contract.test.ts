import { CHECK_IDS, CHECK_METADATA_MAP } from "@beacon/shared";
import { describe, expect, it } from "vitest";
import "../index.js"; // triggers side-effect registrations
import { defaultRegistry } from "../registry.js";

describe("Registry immutability", () => {
	it("registered plugins are frozen", () => {
		for (const plugin of defaultRegistry.getAll()) {
			expect(Object.isFrozen(plugin)).toBe(true);
		}
	});

	it("plugin metadata cannot be mutated via registry", () => {
		const plugin = defaultRegistry.get("llms-txt");
		if (!plugin) throw new Error("expected llms-txt plugin to be registered");
		expect(() => {
			(plugin as unknown as { name: string }).name = "tampered";
		}).toThrow(TypeError);
	});
});

describe("Registry Contract", () => {
	it("every CHECK_ID has a registered plugin", () => {
		for (const id of CHECK_IDS) {
			expect(defaultRegistry.get(id)).toBeDefined();
		}
	});

	it("registry has exactly CHECK_IDS.length plugins", () => {
		expect(defaultRegistry.size).toBe(CHECK_IDS.length);
	});

	it("registered plugin metadata matches CHECK_METADATA_MAP", () => {
		for (const plugin of defaultRegistry.getAll()) {
			const expected = CHECK_METADATA_MAP[plugin.id];
			expect(plugin.name).toBe(expected.name);
			expect(plugin.category).toBe(expected.category);
			expect(plugin.severity).toBe(expected.severity);
		}
	});
});
