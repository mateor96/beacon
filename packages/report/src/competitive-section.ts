export interface CompetitiveSectionRow {
	domain: string;
	score: number;
	trend: "improving" | "declining" | "stable";
	history: number[];
	gapToClient: number;
}

export interface CompetitiveSectionInput {
	clientDomain: string;
	clientScore: number;
	clientHistory: number[];
	competitors: CompetitiveSectionRow[];
	primaryColor?: string;
	secondaryColor?: string;
}

/**
 * Render the "Wettbewerbsanalyse" report section as standalone HTML.
 * Only returns content when competitors.length > 0 — callers should
 * embed the output after the main report or skip it entirely.
 *
 * Charts use inline SVG (polylines for sparklines, rects for bars) so
 * the PDF renderer has no extra runtime dependency.
 */
export function renderCompetitiveSection(input: CompetitiveSectionInput): string {
	if (input.competitors.length === 0) return "";

	const primary = input.primaryColor ?? "#2563eb";
	const secondary = input.secondaryColor ?? "#94a3b8";
	const maxScore = Math.max(input.clientScore, ...input.competitors.map((c) => c.score), 100);

	const trendArrow = (t: CompetitiveSectionRow["trend"]) =>
		t === "improving" ? "↑" : t === "declining" ? "↓" : "→";
	const trendColor = (t: CompetitiveSectionRow["trend"]) =>
		t === "improving" ? "#16a34a" : t === "declining" ? "#dc2626" : "#64748b";

	const sparkline = (points: number[], color: string): string => {
		if (points.length < 2) return "";
		const max = Math.max(...points, 1);
		const coords = points
			.map((p, i) => {
				const x = (i / Math.max(1, points.length - 1)) * 60;
				const y = 20 - (p / max) * 18 - 1;
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(" ");
		return `<svg viewBox="0 0 60 20" width="60" height="20" preserveAspectRatio="none"><polyline fill="none" stroke="${color}" stroke-width="1.5" points="${coords}" /></svg>`;
	};

	const bar = (domain: string, score: number, color: string): string => {
		const pct = (score / maxScore) * 100;
		return `
			<div style="display:flex; align-items:center; gap:8px; font-size:11px; margin:4px 0;">
				<div style="width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${domain}</div>
				<div style="flex:1; background:#f1f5f9; border-radius:3px; height:14px; overflow:hidden;">
					<div style="background:${color}; height:14px; width:${pct.toFixed(1)}%;"></div>
				</div>
				<div style="width:30px; text-align:right;">${score}</div>
			</div>
		`;
	};

	const rows = input.competitors
		.map(
			(c) => `
				<tr>
					<td style="padding:6px 8px;">${c.domain}</td>
					<td style="padding:6px 8px; text-align:right;">${c.score}</td>
					<td style="padding:6px 8px; text-align:center; color:${trendColor(c.trend)};">${trendArrow(c.trend)}</td>
					<td style="padding:6px 8px; text-align:right;">${c.gapToClient >= 0 ? "+" : ""}${c.gapToClient}</td>
					<td style="padding:6px 8px; text-align:center;">${sparkline(c.history, secondary)}</td>
				</tr>`,
		)
		.join("");

	return `
		<section style="page-break-before: always; padding: 24px; font-family: sans-serif; color: #1f2937;">
			<h2 style="color:${primary}; font-size:20px; margin:0 0 16px;">Wettbewerbsanalyse</h2>
			<p style="font-size:12px; color:#64748b; margin:0 0 20px;">
				Vergleich von ${input.clientDomain} gegen ${input.competitors.length}
				Wettbewerber.
			</p>

			<h3 style="font-size:14px; margin:20px 0 8px;">Score-Vergleich</h3>
			${bar(input.clientDomain, input.clientScore, primary)}
			${input.competitors.map((c) => bar(c.domain, c.score, secondary)).join("")}

			<h3 style="font-size:14px; margin:20px 0 8px;">Ranking &amp; Trend</h3>
			<table style="width:100%; border-collapse:collapse; font-size:11px;">
				<thead>
					<tr style="border-bottom:1px solid #cbd5e1; text-align:left;">
						<th style="padding:6px 8px;">Domain</th>
						<th style="padding:6px 8px; text-align:right;">Score</th>
						<th style="padding:6px 8px; text-align:center;">Trend</th>
						<th style="padding:6px 8px; text-align:right;">Differenz</th>
						<th style="padding:6px 8px; text-align:center;">12 Wochen</th>
					</tr>
				</thead>
				<tbody>${rows}</tbody>
			</table>
		</section>
	`;
}
