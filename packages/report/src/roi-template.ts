/**
 * ROI report HTML template (#281).
 *
 * Generates a complete standalone HTML document for ROI reports.
 * Sections: cover, KPIs, summary, timeline, citations, milestones,
 * recommendations, outlook, footer.
 *
 * Uses inline styles for email compatibility. Reuses SVG helpers
 * from scores.ts and roi-charts.ts.
 */

import { mergeBranding } from "./branding.js";
import { renderDeltaArrowSvg, renderTimelineSvg } from "./roi-charts.js";
import { renderGaugeSvg, renderLevelBadge } from "./scores.js";
import { getReportStyles } from "./styles.js";
import type { RoiReportInput } from "./types.js";

// ── HTML Escaping ──────────────────────────────────────────

const ESCAPE_MAP: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#x27;",
};

function esc(str: string): string {
	return str.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch] ?? ch);
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Milestone Type Labels ──────────────────────────────────

const MILESTONE_LABELS: Record<string, string> = {
	score_threshold: "Score-Meilenstein",
	citation_milestone: "Zitierungs-Meilenstein",
	first_mention: "Erste Erwähnung",
	improvement_rate: "Verbesserungsrate",
};

// ── Main Template ──────────────────────────────────────────

export function renderRoiHtml(input: RoiReportInput): string {
	const branding = mergeBranding(input.branding);
	const styles = getReportStyles(branding.primaryColor, branding.accentColor);

	return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ROI Report – ${esc(input.projectName)}</title>
<style>${styles}
body { max-width: 800px; margin: 0 auto; padding: 24px; }
.roi-kpi-grid { display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap; }
.roi-kpi-card { flex: 1; min-width: 140px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; text-align: center; }
.roi-kpi-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
.roi-kpi-value { font-size: 28px; font-weight: 700; margin-top: 4px; }
.roi-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
.roi-table th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600; }
.roi-table td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
.roi-table tr:nth-child(even) td { background: #f9fafb; }
.roi-milestone { padding: 12px 0 12px 20px; border-left: 3px solid var(--primary, #2563eb); position: relative; }
.roi-milestone::before { content: ""; position: absolute; left: -7px; top: 16px; width: 10px; height: 10px; border-radius: 50%; background: var(--primary, #2563eb); }
.roi-milestone-date { font-size: 12px; color: #6b7280; }
.roi-milestone-type { font-size: 11px; color: #9ca3af; text-transform: uppercase; }
.roi-rec { padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 8px; }
.roi-rec-title { font-weight: 600; font-size: 14px; }
.roi-rec-impact { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
.impact-high { background: #fef2f2; color: #dc2626; }
.impact-medium { background: #fffbeb; color: #d97706; }
.impact-low { background: #f0fdf4; color: #16a34a; }
.section { margin-top: 32px; }
.page-break { page-break-before: always; }
</style>
</head>
<body>

<!-- Cover -->
<div style="text-align:center;padding:32px 0;border-bottom:2px solid ${branding.primaryColor}">
  ${branding.logoUrl ? `<img src="${esc(branding.logoUrl)}" alt="" style="max-height:48px;margin-bottom:16px" />` : `<div style="font-size:24px;font-weight:bold;color:${branding.primaryColor}">${esc(branding.agencyName)}</div>`}
  <h1 style="margin:8px 0 4px;font-size:28px;color:#111827">ROI Report</h1>
  <p style="color:#6b7280;font-size:14px">${esc(input.projectName)} &middot; ${esc(input.websiteUrl)}</p>
  <p style="color:#9ca3af;font-size:13px">${formatDate(input.periodStart)} – ${formatDate(input.periodEnd)}</p>
</div>

${
	input.introText
		? `
<!-- Intro Text -->
<div class="section">
  <p style="color:#374151;line-height:1.6;font-size:15px">${esc(input.introText)}</p>
</div>
`
		: ""
}

<!-- KPI Strip -->
<div class="roi-kpi-grid">
  <div class="roi-kpi-card">
    <div class="roi-kpi-label">Score-Veränderung</div>
    <div class="roi-kpi-value">${renderDeltaArrowSvg(input.scoreDelta)}</div>
  </div>
  <div class="roi-kpi-card">
    <div class="roi-kpi-label">Aktueller Score</div>
    <div class="roi-kpi-value" style="color:${input.currentScore >= 80 ? "#16a34a" : input.currentScore >= 40 ? "#d97706" : "#dc2626"}">${input.currentScore}</div>
  </div>
  <div class="roi-kpi-card">
    <div class="roi-kpi-label">Readiness Level</div>
    <div style="margin-top:8px">${renderLevelBadge(input.currentLevel as 0 | 1 | 2 | 3)}</div>
  </div>
</div>

${
	input.aiTexts?.executiveSummary
		? `
<!-- Executive Summary -->
<div class="section">
  <h2 style="font-size:20px;color:#111827">Zusammenfassung</h2>
  <p style="color:#374151;line-height:1.6">${esc(input.aiTexts.executiveSummary)}</p>
</div>
`
		: ""
}

<!-- Score Comparison -->
<div class="section page-break">
  <h2 style="font-size:20px;color:#111827">Score-Vergleich</h2>
  <div style="display:flex;align-items:center;gap:32px;justify-content:center;margin-top:16px">
    <div style="text-align:center">
      <div style="font-size:12px;color:#6b7280;margin-bottom:8px">Baseline</div>
      ${renderGaugeSvg(input.baselineScore, 120)}
    </div>
    <div style="font-size:32px;font-weight:bold">${renderDeltaArrowSvg(input.scoreDelta)}</div>
    <div style="text-align:center">
      <div style="font-size:12px;color:#6b7280;margin-bottom:8px">Aktuell</div>
      ${renderGaugeSvg(input.currentScore, 120)}
    </div>
  </div>
</div>

<!-- Sub-Score Breakdown -->
<div class="section">
  <h2 style="font-size:20px;color:#111827">Kategorie-Aufschlüsselung</h2>
  <table class="roi-table">
    <thead><tr><th>Kategorie</th><th>Vorher</th><th>Nachher</th><th>Delta</th></tr></thead>
    <tbody>
      ${renderSubScoreRow("Lesbarkeit", input.subScoresBefore.readability, input.subScoresAfter.readability)}
      ${renderSubScoreRow("Interaktivität", input.subScoresBefore.interactivity, input.subScoresAfter.interactivity)}
      ${renderSubScoreRow("Transaktional", input.subScoresBefore.transactional, input.subScoresAfter.transactional)}
    </tbody>
  </table>
</div>

<!-- Timeline Chart -->
<div class="section page-break">
  <h2 style="font-size:20px;color:#111827">Score-Verlauf</h2>
  <div style="margin-top:12px">${renderTimelineSvg(input.snapshots)}</div>
</div>

${
	input.citationChanges.length > 0
		? `
<!-- Citation Changes -->
<div class="section">
  <h2 style="font-size:20px;color:#111827">KI-Zitierungen nach Plattform</h2>
  <table class="roi-table">
    <thead><tr><th>Plattform</th><th>Vorher</th><th>Nachher</th><th>Delta</th></tr></thead>
    <tbody>
      ${input.citationChanges.map((c) => `<tr><td style="text-transform:capitalize">${esc(c.platform)}</td><td>${c.before}</td><td>${c.after}</td><td>${renderDeltaArrowSvg(c.after - c.before)}</td></tr>`).join("\n      ")}
    </tbody>
  </table>
</div>
`
		: ""
}

${
	input.milestones.length > 0
		? `
<!-- Milestones -->
<div class="section page-break">
  <h2 style="font-size:20px;color:#111827">Erreichte Meilensteine</h2>
  <div style="margin-top:16px">
    ${input.milestones
			.map(
				(m) => `<div class="roi-milestone">
      <div class="roi-milestone-date">${formatDate(m.triggeredAt)}</div>
      <div class="roi-milestone-type">${esc(MILESTONE_LABELS[m.milestoneType] ?? m.milestoneType)}</div>
      <div style="font-size:14px;color:#374151">${esc(m.description)}</div>
    </div>`,
			)
			.join("\n    ")}
  </div>
</div>
`
		: ""
}

${
	input.aiTexts?.recommendations && input.aiTexts.recommendations.length > 0
		? `
<!-- AI Recommendations -->
<div class="section">
  <h2 style="font-size:20px;color:#111827">Empfehlungen</h2>
  <div style="margin-top:12px">
    ${input.aiTexts.recommendations
			.map(
				(r, i) => `<div class="roi-rec">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="roi-rec-title">${i + 1}. ${esc(r.title)}</span>
        <span class="roi-rec-impact impact-${r.impact}">${r.impact === "high" ? "Hoch" : r.impact === "medium" ? "Mittel" : "Niedrig"}</span>
      </div>
      <p style="margin:4px 0 0;font-size:13px;color:#4b5563">${esc(r.description)}</p>
    </div>`,
			)
			.join("\n    ")}
  </div>
</div>
`
		: ""
}

${
	input.aiTexts?.outlook
		? `
<!-- Outlook -->
<div class="section">
  <h2 style="font-size:20px;color:#111827">Ausblick</h2>
  <p style="color:#374151;line-height:1.6">${esc(input.aiTexts.outlook)}</p>
</div>
`
		: ""
}

<!-- Footer -->
<div style="margin-top:48px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:12px;color:#9ca3af">
  <span>${esc(branding.footerText ?? "Erstellt mit Beacon")}</span>
  <span>Generiert am ${formatDate(new Date().toISOString())}</span>
</div>

</body>
</html>`;
}

// ── Helpers ─────────────────────────────────────────────────

function renderSubScoreRow(label: string, before: number | null, after: number | null): string {
	const b = before ?? 0;
	const a = after ?? 0;
	const delta = a - b;
	return `<tr><td>${label}</td><td>${b}</td><td>${a}</td><td>${renderDeltaArrowSvg(delta)}</td></tr>`;
}
