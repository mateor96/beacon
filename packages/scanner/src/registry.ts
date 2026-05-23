import type { CheckCategory, CheckId, CheckPlugin } from "@beacon/shared";

export class CheckRegistry {
	private plugins = new Map<CheckId, Readonly<CheckPlugin>>();

	register(plugin: CheckPlugin): void {
		if (this.plugins.has(plugin.id)) {
			throw new Error(`Check plugin "${plugin.id}" is already registered`);
		}
		this.plugins.set(plugin.id, Object.freeze(plugin));
	}

	get(id: CheckId): Readonly<CheckPlugin> | undefined {
		return this.plugins.get(id);
	}

	getAll(): Readonly<CheckPlugin>[] {
		return [...this.plugins.values()];
	}

	getByCategory(category: CheckCategory): Readonly<CheckPlugin>[] {
		return this.getAll().filter((p) => p.category === category);
	}

	get size(): number {
		return this.plugins.size;
	}
}

export const defaultRegistry = new CheckRegistry();
