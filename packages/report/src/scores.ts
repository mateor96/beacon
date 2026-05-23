import { LEVEL_NAMES } from "@beacon/shared/constants";
import type { CheckStatus, LevelScores, ReadinessLevel } from "@beacon/shared/types";

// ── Color Constants ─────────────────────────────────────────

export const STATUS_COLORS: Record<CheckStatus, string> = {
	pass: "#16a34a",
	warn: "#d97706",
	fail: "#dc2626",
	info: "#6b7280",
	error: "#7f1d1d",
};

export const LEVEL_COLORS: Record<ReadinessLevel, string> = {
	0: "#dc2626",
	1: "#d97706",
	2: "#3b82f6",
	3: "#16a34a",
};

// ── Score Helpers ───────────────────────────────────────────

/** Returns a color based on score thresholds: green >=80, amber >=40, red <40 */
export function scoreToColor(score: number): string {
	if (score >= 80) return "#16a34a";
	if (score >= 40) return "#d97706";
	return "#dc2626";
}

/** Returns the color for a given check status. */
export function statusToColor(status: CheckStatus): string {
	return STATUS_COLORS[status] ?? STATUS_COLORS.info;
}

// ── SVG Gauge ───────────────────────────────────────────────

/** Renders an SVG donut ring gauge for the given score (0–100). */
export function renderGaugeSvg(score: number, size = 160): string {
	const radius = size / 2 - 10;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference * (1 - score / 100);
	const color = scoreToColor(score);
	const center = size / 2;

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
		// Background circle
		`  <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#e5e7eb" stroke-width="12" />`,
		// Foreground arc
		`  <circle cx="${center}" cy="${center}" r="${radius}" fill="none"`,
		`    stroke="${color}" stroke-width="12" stroke-linecap="round"`,
		`    stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"`,
		`    transform="rotate(-90 ${center} ${center})" />`,
		// Score number
		`  <text x="${center}" y="${center}" text-anchor="middle" dominant-baseline="central"`,
		`    font-family="system-ui, sans-serif" font-weight="bold" font-size="${size * 0.25}px" fill="${color}">`,
		`    ${score}`,
		"  </text>",
		// "/100" label
		`  <text x="${center}" y="${center + size * 0.15}" text-anchor="middle"`,
		`    font-family="system-ui, sans-serif" font-size="${size * 0.1}px" fill="#6b7280">`,
		"    /100",
		"  </text>",
		"</svg>",
	].join("\n");
}

// ── Level Badge ─────────────────────────────────────────────

/** Renders an HTML pill badge for the given readiness level. */
export function renderLevelBadge(level: ReadinessLevel): string {
	const color = LEVEL_COLORS[level];
	const textColor = level === 1 ? "#1c1917" : "#ffffff";
	const name = LEVEL_NAMES[level];

	return `<span class="level-badge" style="background:${color};color:${textColor};padding:4px 12px;border-radius:9999px;font-weight:600;font-size:14px;display:inline-block">Level ${level} — ${name}</span>`;
}

// ── Score Bar ───────────────────────────────────────────────

/** Renders a horizontal score bar with label, colored fill, and numeric score. */
export function renderScoreBar(label: string, score: number, status: CheckStatus): string {
	const fillColor = STATUS_COLORS[status];

	return [
		`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">`,
		`  <span style="width:200px;font-size:14px;font-weight:500">${label}</span>`,
		`  <div style="flex:1;height:12px;background:#e5e7eb;border-radius:6px;overflow:hidden">`,
		`    <div style="width:${score}%;height:100%;background:${fillColor};border-radius:6px"></div>`,
		"  </div>",
		`  <span style="width:40px;text-align:right;font-size:14px;font-weight:600">${score}</span>`,
		"</div>",
	].join("\n");
}

// ── Category Bars ───────────────────────────────────────────

function categoryStatus(score: number): CheckStatus {
	if (score >= 80) return "pass";
	if (score >= 40) return "warn";
	return "fail";
}

/** Renders horizontal bars for evaluated categories (skips null = not evaluated). */
export function renderCategoryBars(levelScores: LevelScores): string {
	const categories: { label: string; key: keyof LevelScores }[] = [
		{ label: "Lesbarkeit", key: "readability" },
		{ label: "Interaktivität", key: "interactivity" },
		{ label: "Transaktional", key: "transactional" },
	];

	return categories
		.flatMap(({ label, key }) => {
			const value = levelScores[key];
			return value == null ? [] : [renderScoreBar(label, value, categoryStatus(value))];
		})
		.join("\n");
}

/** Renders three horizontal bars for level breakdown (alias for renderCategoryBars). */
export function renderLevelBreakdown(levelScores: LevelScores): string {
	return renderCategoryBars(levelScores);
}
