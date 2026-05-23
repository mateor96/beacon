import { describe, expect, it, vi } from "vitest";

// Drizzle mock capturing the chained query builder calls.
function createMockDb() {
	const insertValues = { value: undefined as unknown };
	const deleteWhere = { called: false };
	const findFirstWhere = { value: undefined as unknown };
	const findManyWhere = { value: undefined as unknown };

	const mockDb = {
		insert: vi.fn().mockReturnValue({
			values: vi.fn().mockImplementation((data: unknown) => {
				insertValues.value = data;
				return {
					returning: vi.fn().mockResolvedValue([{ id: "key-1", ...(data as object) }]),
				};
			}),
		}),
		delete: vi.fn().mockReturnValue({
			where: vi.fn().mockImplementation(() => {
				deleteWhere.called = true;
				return {
					returning: vi.fn().mockResolvedValue([{ id: "key-1" }]),
				};
			}),
		}),
		query: {
			apiKeys: {
				findFirst: vi.fn().mockImplementation((opts: { where: unknown }) => {
					findFirstWhere.value = opts?.where;
					return Promise.resolve({ id: "key-1", prefix: "awr_live" });
				}),
				findMany: vi.fn().mockImplementation((opts: { where: unknown }) => {
					findManyWhere.value = opts?.where;
					return Promise.resolve([{ id: "key-1" }, { id: "key-2" }]);
				}),
			},
		},
		_insertValues: insertValues,
		_deleteWhere: deleteWhere,
		_findFirstWhere: findFirstWhere,
		_findManyWhere: findManyWhere,
	};
	return mockDb;
}

describe("api-keys queries", () => {
	it("create inserts with the provided data", async () => {
		const mockDb = createMockDb();
		const { create } = await import("../queries/api-keys.js");
		const data = {
			userId: "user-1",
			prefix: "awr_live",
			hashedKey: "sha256-abc",
			name: "Production",
		};
		const result = await create(mockDb as never, data as never);
		expect(mockDb.insert).toHaveBeenCalled();
		expect(result).toBeDefined();
		expect(result.prefix).toBe("awr_live");
	});

	it("getByUserId queries with userId filter", async () => {
		const mockDb = createMockDb();
		const { getByUserId } = await import("../queries/api-keys.js");
		const result = await getByUserId(mockDb as never, "user-1");
		expect(mockDb.query.apiKeys.findMany).toHaveBeenCalled();
		expect(result).toHaveLength(2);
	});

	it("deleteById deletes by id and returns the deleted row", async () => {
		const mockDb = createMockDb();
		const { deleteById } = await import("../queries/api-keys.js");
		const result = await deleteById(mockDb as never, "key-1");
		expect(mockDb.delete).toHaveBeenCalled();
		expect(mockDb._deleteWhere.called).toBe(true);
		expect(result).toBeDefined();
		expect(result?.id).toBe("key-1");
	});

	it("getActiveByPrefix uses findFirst with prefix filter", async () => {
		const mockDb = createMockDb();
		const { getActiveByPrefix } = await import("../queries/api-keys.js");
		const result = await getActiveByPrefix(mockDb as never, "awr_live");
		expect(mockDb.query.apiKeys.findFirst).toHaveBeenCalled();
		expect(result).toBeDefined();
		expect(result?.prefix).toBe("awr_live");
	});
});
