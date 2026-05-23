/**
 * Storage adapter for CSV export outputs (#225).
 *
 * Production deployments configure an S3/R2 adapter. The default
 * LocalFilesystemStorage writes under a configurable directory and
 * returns a file:// URL — useful for dev + CI where no object store
 * is provisioned.
 */

export interface StoragePutResult {
	key: string;
	bytes: number;
	url: string;
	urlExpiresAt: Date;
}

export interface CsvExportStorage {
	/** Writes the Uint8Array to the given key and returns a signed URL. */
	put(key: string, bytes: Uint8Array, opts?: { ttlSeconds?: number }): Promise<StoragePutResult>;
}

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export class LocalFilesystemStorage implements CsvExportStorage {
	constructor(private readonly rootDir: string) {}

	async put(
		key: string,
		bytes: Uint8Array,
		opts: { ttlSeconds?: number } = {},
	): Promise<StoragePutResult> {
		const target = path.join(this.rootDir, key);
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, bytes);
		const ttlSeconds = opts.ttlSeconds ?? 24 * 60 * 60;
		return {
			key,
			bytes: bytes.byteLength,
			url: `file://${target}`,
			urlExpiresAt: new Date(Date.now() + ttlSeconds * 1000),
		};
	}
}

/** Factory. Swap this function to return an S3/R2 adapter in production. */
export function buildCsvExportStorage(): CsvExportStorage {
	const root = process.env.CSV_EXPORT_LOCAL_DIR ?? "/tmp/beacon-csv-exports";
	return new LocalFilesystemStorage(root);
}
