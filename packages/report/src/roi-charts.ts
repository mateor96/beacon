/**
 * Server-side SVG chart rendering for ROI reports (#281).
 * Pure string building — no Canvas, no browser dependency.
 * Follows the same pattern as scores.ts (renderGaugeSvg).
 */

import { scoreToColor } from "./scores.js";
import type { RoiSnapshotPoint } from "./types.js";

// ── Timeline Chart ─────────────────────────────────────────

/**
 * Renders an SVG line chart showing score progression over time.
 * Returns a complete inline SVG string.
 */
export function renderTimelineSvg(
	snapshots: RoiSnapshotPoint[],
	width = 600,
	height = 220,
): string {
	if (snapshots.length === 0) {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#9ca3af" font-size="14" font-family="system-ui, sans-serif">Keine Daten vorhanden</text>
</svg>`;
	}

	const padding = { top: 20, right: 20, bottom: 40, left: 45 };
	const chartW = width - padding.left - padding.right;
	const chartH = height - padding.top - padding.bottom;

	// Compute positions
	const points = snapshots.map((s, i) => {
		const x = snapshots.length === 1 ? chartW / 2 : (i / (snapshots.length - 1)) * chartW;
		const y = chartH - (s.overallScore / 100) * chartH;
		return { x: x + padding.left, y: y + padding.top, score: s.overallScore, date: s.date };
	});

	const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
	const lineColor = scoreToColor(snapshots[snapshots.length - 1]?.overallScore);

	// Y-axis grid lines
	const gridLines = [0, 25, 50, 75, 100].map((val) => {
		const y = padding.top + chartH - (val / 100) * chartH;
		return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />
<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="#9ca3af" font-size="10" font-family="system-ui, sans-serif">${val}</text>`;
	});

	// X-axis date labels (show max 6)
	const maxLabels = Math.min(6, snapshots.length);
	const step = Math.max(1, Math.floor((snapshots.length - 1) / (maxLabels - 1)));
	const dateLabels = points
		.filter((_, i) => i % step === 0 || i === points.length - 1)
		.map((p) => {
			const d = new Date(p.date);
			const label = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
			return `<text x="${p.x}" y="${height - 8}" text-anchor="middle" fill="#9ca3af" font-size="10" font-family="system-ui, sans-serif">${label}</text>`;
		});

	// Data point circles
	const circles = points.map(
		(p) =>
			`<circle cx="${p.x}" cy="${p.y}" r="4" fill="${lineColor}" stroke="white" stroke-width="2"><title>${p.score} Punkte</title></circle>`,
	);

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="white" rx="8" />
  ${gridLines.join("\n  ")}
  <polyline points="${polylinePoints}" fill="none" stroke="${lineColor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
  ${circles.join("\n  ")}
  ${dateLabels.join("\n  ")}
</svg>`;
}

// ── Delta Arrow ────────────────────────────────────────────

/**
 * Small inline SVG showing a delta value with up/down arrow.
 */
export function renderDeltaArrowSvg(delta: number): string {
	if (delta === 0) {
		return `<span style="color:#9ca3af;font-weight:bold">±0</span>`;
	}
	const isPositive = delta > 0;
	const color = isPositive ? "#16a34a" : "#dc2626";
	const arrow = isPositive ? "&#9650;" : "&#9660;";
	const sign = isPositive ? "+" : "";
	return `<span style="color:${color};font-weight:bold">${arrow} ${sign}${delta}</span>`;
}
