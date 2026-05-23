export interface LocaleSectionRow {
	displayName: string;
	countryCode: string;
	languageCode: string;
	score: number;
	previousScore: number | null;
	scannedAt: string | null;
	topRecommendations: string[];
	isPrimary: boolean;
}

export interface LocaleSectionInput {
	clientDomain: string;
	rows: LocaleSectionRow[];
	primaryColor?: string;
	secondaryColor?: string;
}

const PALETTE = [
	"#2563eb", // blue
	"#10b981", // emerald
	"#f59e0b", // amber
	"#9333ea", // purple
	"#ef4444", // rose
	"#0d9488", // teal
	"#f97316", // orange
	"#6366f1", // indigo
];

const ROWS_PER_PAGE = 5;

function fmtDate(iso: string | null): string {
	if (!iso) return "noch nicht gescannt";
	const d = new Date(iso);
	return d.toLocaleDateString("de-DE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function delta(curr: number, prev: number | null): { text: string; color: string } {
	if (prev === null) return { text: "—", color: "#64748b" };
	const d = curr - prev;
	if (d > 0) return { text: `+${d}`, color: "#16a34a" };
	if (d < 0) return { text: `${d}`, color: "#dc2626" };
	return { text: "0", color: "#64748b" };
}

function chunk<T>(arr: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
}

/**
 * Render the multi-locale comparison section as standalone HTML for the PDF
 * generator. Returns "" when rows.length === 0 so callers can compose freely.
 *
 * Layout:
 *  - Page 1: title + horizontal bar chart (all locales)
 *  - Page 2+: detail table, max 5 locales per page (issue #241 acceptance)
 *
 * Report stays in German regardless of the analyzed locales.
 */
export function renderLocaleSection(input: LocaleSectionInput): string {
	if (input.rows.length === 0) return "";

	const primary = input.primaryColor ?? "#2563eb";
	const maxScore = Math.max(...input.rows.map((r) => r.score), 100);

	const colorFor = (idx: number) => PALETTE[idx % PALETTE.length];

	const bar = (row: LocaleSectionRow, color: string) => {
		const pct = (row.score / maxScore) * 100;
		const label = `${row.displayName} (${row.countryCode}-${row.languageCode})${row.isPrimary ? " ★" : ""}`;
		return `
			<div style="display:flex; align-items:center; gap:8px; font-size:11px; margin:4px 0;">
				<div style="width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${label}</div>
				<div style="flex:1; background:#f1f5f9; border-radius:3px; height:14px; overflow:hidden;">
					<div style="background:${color}; height:14px; width:${pct.toFixed(1)}%;"></div>
				</div>
				<div style="width:30px; text-align:right;">${row.score}</div>
			</div>
		`;
	};

	const detailRow = (row: LocaleSectionRow, color: string) => {
		const d = delta(row.score, row.previousScore);
		const recs = row.topRecommendations.slice(0, 3);
		return `
			<tr>
				<td style="padding:6px 8px;">
					<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${color}; margin-right:6px;"></span>
					${row.displayName}
					${row.isPrimary ? '<span style="color:#1d4ed8; font-size:10px; margin-left:6px;">[Primaer]</span>' : ""}
				</td>
				<td style="padding:6px 8px; text-align:right; font-family:monospace;">${row.score}</td>
				<td style="padding:6px 8px; text-align:right; color:${d.color}; font-family:monospace;">${d.text}</td>
				<td style="padding:6px 8px; font-size:10px; color:#475569;">${recs.length === 0 ? "—" : recs.join("; ")}</td>
				<td style="padding:6px 8px; font-size:10px; color:#64748b;">${fmtDate(row.scannedAt)}</td>
			</tr>
		`;
	};

	const detailPages = chunk(input.rows, ROWS_PER_PAGE)
		.map((pageRows, pageIdx) => {
			const startIdx = pageIdx * ROWS_PER_PAGE;
			const headerLabel = `Detail ${startIdx + 1}–${startIdx + pageRows.length} von ${input.rows.length}`;
			const tableRows = pageRows.map((r, i) => detailRow(r, colorFor(startIdx + i))).join("");
			return `
				<section style="page-break-before: always; padding: 24px; font-family: sans-serif; color:#1f2937;">
					<h3 style="color:${primary}; font-size:16px; margin:0 0 12px;">AI-Readiness pro Locale — ${headerLabel}</h3>
					<table style="width:100%; border-collapse:collapse; font-size:11px;">
						<thead>
							<tr style="border-bottom:1px solid #cbd5e1; text-align:left;">
								<th style="padding:6px 8px;">Locale</th>
								<th style="padding:6px 8px; text-align:right;">Score</th>
								<th style="padding:6px 8px; text-align:right;">Δ Vorscan</th>
								<th style="padding:6px 8px;">Top-Empfehlungen</th>
								<th style="padding:6px 8px;">Letzter Scan</th>
							</tr>
						</thead>
						<tbody>${tableRows}</tbody>
					</table>
				</section>
			`;
		})
		.join("");

	return `
		<section style="page-break-before: always; padding: 24px; font-family: sans-serif; color:#1f2937;">
			<h2 style="color:${primary}; font-size:20px; margin:0 0 16px;">AI-Readiness nach Markt/Sprache</h2>
			<p style="font-size:12px; color:#64748b; margin:0 0 20px;">
				Vergleich der AI-Readiness von ${input.clientDomain} über
				${input.rows.length} konfigurierte Locale${input.rows.length === 1 ? "" : "s"}.
			</p>

			<h3 style="font-size:14px; margin:20px 0 8px;">Score-Vergleich</h3>
			${input.rows.map((r, i) => bar(r, colorFor(i))).join("")}
		</section>
		${detailPages}
	`;
}
