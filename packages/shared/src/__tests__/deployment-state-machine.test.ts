import { describe, expect, it } from "vitest";
import {
	VALID_DEPLOYMENT_TRANSITIONS,
	assertValidDeploymentTransition,
	isTerminalDeploymentStatus,
	isValidDeploymentTransition,
} from "../deployment-state-machine.js";

describe("isValidDeploymentTransition", () => {
	it.each([
		["pending", "in_progress"],
		["pending", "failed"],
		["in_progress", "succeeded"],
		["in_progress", "failed"],
		["succeeded", "rolled_back"],
		["succeeded", "failed"],
	] as const)("%s → %s is valid", (from, to) => {
		expect(isValidDeploymentTransition(from, to)).toBe(true);
	});

	it.each([
		["pending", "succeeded"],
		["pending", "rolled_back"],
		["in_progress", "pending"],
		["in_progress", "rolled_back"],
		["succeeded", "pending"],
		["succeeded", "in_progress"],
		["failed", "pending"],
		["failed", "in_progress"],
		["failed", "succeeded"],
		["failed", "rolled_back"],
		["rolled_back", "pending"],
		["rolled_back", "succeeded"],
	] as const)("%s → %s is invalid", (from, to) => {
		expect(isValidDeploymentTransition(from, to)).toBe(false);
	});
});

describe("assertValidDeploymentTransition", () => {
	it("does not throw for valid transition", () => {
		expect(() => assertValidDeploymentTransition("pending", "in_progress")).not.toThrow();
	});

	it("throws for invalid transition", () => {
		expect(() => assertValidDeploymentTransition("failed", "succeeded")).toThrow(
			"Ungültiger Status-Uebergang",
		);
	});
});

describe("isTerminalDeploymentStatus", () => {
	it("returns true for failed", () => {
		expect(isTerminalDeploymentStatus("failed")).toBe(true);
	});

	it("returns true for rolled_back", () => {
		expect(isTerminalDeploymentStatus("rolled_back")).toBe(true);
	});

	it("returns false for pending", () => {
		expect(isTerminalDeploymentStatus("pending")).toBe(false);
	});

	it("returns false for succeeded", () => {
		expect(isTerminalDeploymentStatus("succeeded")).toBe(false);
	});
});

describe("VALID_DEPLOYMENT_TRANSITIONS", () => {
	it("has entries for all 5 statuses", () => {
		expect(Object.keys(VALID_DEPLOYMENT_TRANSITIONS)).toHaveLength(5);
	});
});

describe("self-transitions", () => {
	it.each(["pending", "in_progress", "succeeded", "failed", "rolled_back"] as const)(
		"%s -> %s self-transition is invalid",
		(status) => {
			expect(isValidDeploymentTransition(status, status)).toBe(false);
		},
	);
});

describe("isTerminalDeploymentStatus (additional)", () => {
	it("returns false for in_progress", () => {
		expect(isTerminalDeploymentStatus("in_progress")).toBe(false);
	});
});
