#!/usr/bin/env node

/**
 * Verifies the apps/web consumer policy for workspace packages.
 *
 * 1. Scanner + Queue export targets exist on disk after build
 * 2. @beacon/shared dist is importable (diagnostic)
 * 3. @beacon/scanner and @beacon/queue are importable from apps/web context
 * 4. tsconfig paths, vitest aliases, and transpilePackages cover the same whitelist
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

let failed = false;

function log(step, msg) {
	console.log(`\n[${"=".repeat(3)} ${step} ${"=".repeat(3)}] ${msg}`);
}

function fail(msg) {
	console.error(`  FAIL: ${msg}`);
	failed = true;
}

function pass(msg) {
	console.log(`  OK: ${msg}`);
}

// --- Step 1: Verify export targets exist on disk ---

log("EXPORTS", "Checking scanner and queue export targets exist");

const exportChecks = [
	{ pkg: "@beacon/scanner", file: "packages/scanner/package.json" },
	{ pkg: "@beacon/queue", file: "packages/queue/package.json" },
];

for (const { pkg, file } of exportChecks) {
	const pkgJson = JSON.parse(readFileSync(resolve(ROOT, file), "utf-8"));
	const defaultExport = pkgJson.exports?.["."]?.default;
	if (!defaultExport) {
		fail(`${pkg}: no exports["."].default found`);
		continue;
	}
	const target = resolve(ROOT, dirname(file), defaultExport);
	if (existsSync(target)) {
		pass(`${pkg}: ${defaultExport} exists`);
	} else {
		fail(`${pkg}: ${defaultExport} does not exist at ${target}`);
	}
}

// --- Step 2: Verify @beacon/shared dist is importable (diagnostic) ---

log("IMPORT", "Checking @beacon/shared dist is importable (diagnostic)");

const sharedEntry = resolve(ROOT, "packages/shared/dist/index.js");
if (existsSync(sharedEntry)) {
	try {
		await import(pathToFileURL(sharedEntry).href);
		pass("@beacon/shared: dynamic import succeeded");
	} catch (err) {
		fail(`@beacon/shared: dynamic import failed — ${err.message}`);
	}
} else {
	fail("@beacon/shared: dist/index.js does not exist (build first)");
}

// --- Step 3: Verify scanner + queue are importable from apps/web context ---

log("CONSUMER", "Checking @beacon/scanner and @beacon/queue are importable from apps/web context");

const webRequire = createRequire(resolve(ROOT, "apps/web/package.json"));
const consumerPackages = ["@beacon/scanner", "@beacon/queue"];

for (const pkg of consumerPackages) {
	// Step A: resolve bare specifier from web context
	let resolved;
	try {
		resolved = webRequire.resolve(pkg);
		pass(`${pkg}: resolves from apps/web to ${resolved}`);
	} catch (err) {
		fail(`${pkg}: bare specifier resolution failed from apps/web — ${err.message}`);
		continue;
	}

	// Step B: dynamically import the resolved file
	try {
		await import(pathToFileURL(resolved).href);
		pass(`${pkg}: dynamic import succeeded`);
	} catch (err) {
		fail(`${pkg}: dynamic import failed — ${err.message}`);
	}
}

// --- Step 4: Verify whitelist consistency across resolution layers ---

log("WHITELIST", "Checking tsconfig paths, vitest aliases, and transpilePackages are consistent");

// Extract package families (e.g. "@beacon/auth/browser" → "auth")
function extractFamilies(keys) {
	const families = new Set();
	for (const key of keys) {
		const match = key.match(/^@beacon\/([^/]+)/);
		if (match) families.add(match[1]);
	}
	return [...families].sort();
}

// 4a. tsconfig paths
const tsconfig = JSON.parse(readFileSync(resolve(ROOT, "apps/web/tsconfig.json"), "utf-8"));
const tsconfigKeys = Object.keys(tsconfig.compilerOptions?.paths ?? {}).filter((k) =>
	k.startsWith("@beacon/"),
);
const tsconfigFamilies = extractFamilies(tsconfigKeys);

// 4b. vitest aliases (parse from source)
const vitestSrc = readFileSync(resolve(ROOT, "apps/web/vitest.config.ts"), "utf-8");
const vitestKeys = [...vitestSrc.matchAll(/"(@beacon\/[^"]+)"/g)].map((m) => m[1]);
const vitestFamilies = extractFamilies(vitestKeys);

// 4c. transpilePackages
const nextSrc = readFileSync(resolve(ROOT, "apps/web/next.config.ts"), "utf-8");
const transpileKeys = [...nextSrc.matchAll(/"(@beacon\/[^"]+)"/g)].map((m) => m[1]);
const transpileFamilies = extractFamilies(transpileKeys);

console.log(`  tsconfig families:        [${tsconfigFamilies.join(", ")}]`);
console.log(`  vitest families:          [${vitestFamilies.join(", ")}]`);
console.log(`  transpilePackages families: [${transpileFamilies.join(", ")}]`);

// Compare
function arraysEqual(a, b) {
	return a.length === b.length && a.every((v, i) => v === b[i]);
}

if (!arraysEqual(tsconfigFamilies, vitestFamilies)) {
	fail(
		`tsconfig and vitest families differ:\n    tsconfig: [${tsconfigFamilies}]\n    vitest:   [${vitestFamilies}]`,
	);
} else {
	pass("tsconfig and vitest families match");
}

if (!arraysEqual(tsconfigFamilies, transpileFamilies)) {
	fail(
		`tsconfig and transpilePackages families differ:\n    tsconfig:          [${tsconfigFamilies}]\n    transpilePackages: [${transpileFamilies}]`,
	);
} else {
	pass("tsconfig and transpilePackages families match");
}

// --- Result ---
if (failed) {
	console.error("\n--- VERIFICATION FAILED ---");
	process.exit(1);
} else {
	log("DONE", "All web workspace policy checks passed!");
	process.exit(0);
}
