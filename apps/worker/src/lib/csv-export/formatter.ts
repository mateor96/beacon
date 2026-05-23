/**
 * CSV formatting helpers (#225). RFC 4180-ish with UTF-8 BOM for Excel.
 */

export const UTF8_BOM = "\uFEFF";

/** Escape a single field per RFC 4180: wrap in quotes if it contains ,"\n\r; double-quote any " */
export function escapeCell(value: unknown): string {
	if (value === null || value === undefined) return "";
	const s =
		value instanceof Date
			? value.toISOString()
			: typeof value === "object"
				? JSON.stringify(value)
				: String(value);
	if (/[,"\n\r]/.test(s)) {
		return `"${s.replace(/"/g, '""')}"`;
	}
	return s;
}

export function buildHeader(columns: string[]): string {
	return `${columns.map(escapeCell).join(",")}\r\n`;
}

export function buildRow(record: Record<string, unknown>, columns: string[]): string {
	return `${columns.map((c) => escapeCell(record[c])).join(",")}\r\n`;
}
