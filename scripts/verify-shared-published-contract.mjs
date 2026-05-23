#!/usr/bin/env node

/**
 * Verifies the published package contract of @beacon/shared.
 *
 * Packs @beacon/shared into a tarball, extracts it to assert no src/ or
 * __tests__/ leak, then installs it into a minimal temp consumer and
 * runs tsc --noEmit to prove the exports contract holds.
 */

import { execSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const KEEP_TEMP = process.env.KEEP_TEMP === "1";

let tempDir;

function log(step, msg) {
	console.log(`\n[${"=".repeat(3)} ${step} ${"=".repeat(3)}] ${msg}`);
}

function run(cmd, opts = {}) {
	console.log(`  > ${cmd}`);
	execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
}

function runCapture(cmd, opts = {}) {
	console.log(`  > ${cmd}`);
	return execSync(cmd, { encoding: "utf-8", cwd: ROOT, ...opts }).trim();
}

function fail(err) {
	console.error("\n--- VERIFICATION FAILED ---");
	if (tempDir) {
		console.error(`Temp dir preserved for debugging: ${tempDir}`);
	}
	console.error(err?.message ?? err);
	process.exit(1);
}

try {
	// 1. Create temp directory
	tempDir = mkdtempSync(join(tmpdir(), "beacon-shared-contract-"));
	const tarballsDir = join(tempDir, "tarballs");
	const extractDir = join(tempDir, "extracted");
	const consumerDir = join(tempDir, "consumer");
	mkdirSync(tarballsDir);
	mkdirSync(extractDir);
	mkdirSync(consumerDir);

	log("CLEAN", "Cleaning packages/shared");
	run("pnpm --dir packages/shared run clean");

	// 2. Build @beacon/shared
	log("BUILD", "Building @beacon/shared");
	run("pnpm exec turbo run build --filter=@beacon/shared");

	// 3. Pack tarball
	log("PACK", `Packing tarball into ${tarballsDir}`);
	run(`pnpm --dir packages/shared pack --pack-destination "${tarballsDir}"`);

	// 4. Extract and assert contents
	log("ASSERT", "Extracting tarball and checking contents");
	const tgzFiles = readdirSync(tarballsDir).filter((f) => f.endsWith(".tgz"));
	if (tgzFiles.length !== 1) {
		fail(new Error(`Expected 1 .tgz file, found ${tgzFiles.length}: ${tgzFiles}`));
	}
	const tgzPath = join(tarballsDir, tgzFiles[0]);

	run(`tar xzf "${tgzPath}" -C "${extractDir}"`);

	// List all files in the extracted package (portable, no GNU find)
	function listFiles(dir, prefix = "") {
		const result = [];
		for (const entry of readdirSync(dir)) {
			const full = join(dir, entry);
			const rel = prefix ? `${prefix}/${entry}` : entry;
			if (statSync(full).isDirectory()) {
				result.push(...listFiles(full, rel));
			} else {
				result.push(rel);
			}
		}
		return result;
	}
	const files = listFiles(extractDir);
	console.log(`  Files in tarball:\n${files.map((f) => `    ${f}`).join("\n")}`);

	// Assert no src/ entries (tarball extracts into package/)
	const srcFiles = files.filter((f) => /(?:^|\/|\\)src\//.test(f));
	if (srcFiles.length > 0) {
		fail(new Error(`Tarball contains src/ files:\n  ${srcFiles.join("\n  ")}`));
	}

	// Assert no __tests__/ entries
	const testFiles = files.filter((f) => f.includes("__tests__"));
	if (testFiles.length > 0) {
		fail(new Error(`Tarball contains __tests__/ files:\n  ${testFiles.join("\n  ")}`));
	}

	// Assert expected .d.ts files present
	const expectedDts = [
		"index.d.ts",
		"types.d.ts",
		"constants.d.ts",
		"validation.d.ts",
		"crypto-aes-gcm.d.ts",
	];
	for (const dts of expectedDts) {
		const found = files.some((f) => f.endsWith(`dist/${dts}`));
		if (!found) {
			fail(new Error(`Missing expected declaration file: dist/${dts}`));
		}
	}
	console.log("  All content assertions passed.");

	// 5. Create minimal consumer to verify types resolve
	log("CONSUMER", "Setting up temp consumer project");

	const rootPkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
	const sharedPkg = JSON.parse(readFileSync(join(ROOT, "packages/shared/package.json"), "utf-8"));
	const sharedTgz = `beacon-shared-${sharedPkg.version}.tgz`;

	writeFileSync(
		join(consumerDir, "package.json"),
		`${JSON.stringify(
			{
				name: "shared-contract-consumer",
				version: "0.0.0",
				private: true,
				type: "module",
				packageManager: rootPkg.packageManager,
				scripts: {
					typecheck: "tsc --noEmit",
				},
				dependencies: {
					"@beacon/shared": `file:../tarballs/${sharedTgz}`,
					zod: sharedPkg.dependencies.zod,
				},
				devDependencies: {
					typescript: sharedPkg.devDependencies.typescript,
				},
			},
			null,
			2,
		)}\n`,
	);

	writeFileSync(
		join(consumerDir, "tsconfig.json"),
		`${JSON.stringify(
			{
				compilerOptions: {
					target: "ES2022",
					module: "Node16",
					moduleResolution: "Node16",
					strict: true,
					skipLibCheck: false,
					noEmit: true,
				},
				include: ["check.ts"],
			},
			null,
			2,
		)}\n`,
	);

	writeFileSync(
		join(consumerDir, "check.ts"),
		[
			'import type {} from "@beacon/shared";',
			'import type {} from "@beacon/shared/types";',
			'import type {} from "@beacon/shared/constants";',
			'import type {} from "@beacon/shared/validation";',
			'import type {} from "@beacon/shared/crypto-aes-gcm";',
			"",
		].join("\n"),
	);

	// 6. Install dependencies
	log("INSTALL", "Installing dependencies in consumer");
	run("pnpm install --prefer-offline --no-frozen-lockfile", {
		cwd: consumerDir,
	});

	// 7. Typecheck
	log("TYPECHECK", "Running tsc --noEmit");
	run("pnpm run typecheck", { cwd: consumerDir });

	// 8. Cleanup
	log("DONE", "All contract checks passed!");
	if (KEEP_TEMP) {
		console.log(`Temp dir kept at: ${tempDir}`);
	} else {
		rmSync(tempDir, { recursive: true, force: true });
		console.log("Temp dir cleaned up.");
	}
	process.exit(0);
} catch (err) {
	fail(err);
}
