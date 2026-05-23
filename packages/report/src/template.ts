import type { CheckCategory, ScanCheck } from "@beacon/shared";
import { LEVEL_NAMES } from "@beacon/shared";
import { mergeBranding } from "./branding.js";
import { renderCategoryBars, renderGaugeSvg, renderLevelBadge, renderScoreBar } from "./scores.js";
import { getReportStyles } from "./styles.js";
import type { ReportInput } from "./types.js";

// ── HTML Escaping ──────────────────────────────────────────

const ESCAPE_MAP: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#x27;",
};

function escapeHtml(str: string): string {
	return str.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch] ?? ch);
}

// ── Category Labels ────────────────────────────────────────

const CATEGORY_LABELS: Record<CheckCategory, string> = {
	readability: "Lesbarkeit",
	interactivity: "Interaktivität",
	transactional: "Transaktional",
};

const CATEGORY_ORDER: CheckCategory[] = ["readability", "interactivity", "transactional"];

// ── Severity Dots ──────────────────────────────────────────

const SEVERITY_DOT_COLORS = {
	critical: "#dc2626",
	important: "#d97706",
	"nice-to-have": "#6b7280",
} as const;

// ── Helpers ────────────────────────────────────────────────

function groupChecksByCategory(checks: ScanCheck[]): Map<CheckCategory, ScanCheck[]> {
	const groups = new Map<CheckCategory, ScanCheck[]>();
	for (const cat of CATEGORY_ORDER) {
		groups.set(cat, []);
	}
	for (const check of checks) {
		const list = groups.get(check.category);
		if (list) {
			list.push(check);
		}
	}
	return groups;
}

function formatDate(isoString: string): string {
	try {
		const d = new Date(isoString);
		return d.toLocaleDateString("de-DE", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return isoString;
	}
}

function renderParagraphs(text: string): string {
	return text
		.split(/\n\n+/)
		.filter(Boolean)
		.map((p) => `<p>${escapeHtml(p.trim())}</p>`)
		.join("\n");
}

// ── Main Template ──────────────────────────────────────────

export function renderHtml(input: ReportInput): string {
	const branding = mergeBranding(input.branding);
	const safeUrl = escapeHtml(input.url);
	const safeAgency = escapeHtml(branding.agencyName);
	const scanDate = formatDate(input.scannedAt);
	const now = formatDate(new Date().toISOString());
	const grouped = groupChecksByCategory(input.checks);
	const levelName = LEVEL_NAMES[input.readinessLevel];

	return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Beacon Report — ${safeUrl}</title>
  <style>${getReportStyles(branding.primaryColor, branding.accentColor)}</style>
</head>
<body>
<div class="report-container">

  <!-- ─── Cover Page ──────────────────────────────────────── -->
  <div class="section">
    <div class="report-header">
      <div>
        ${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${safeAgency}" class="brand-logo" />` : `<span class="brand-name">${safeAgency}</span>`}
      </div>
      <div style="text-align:right;font-size:12px;color:#6b7280">
        Scan: ${scanDate}
      </div>
    </div>

    <h1 style="text-align:center;margin-top:32px">Agentic Web Readiness Report</h1>
    <p style="text-align:center;font-size:16px;color:#6b7280;margin-bottom:24px">
      ${input.finalUrl && input.finalUrl !== input.url ? `${safeUrl} &rarr; ${escapeHtml(input.finalUrl)}` : safeUrl}
    </p>

    <div class="gauge-container" style="margin:24px 0">
      ${renderGaugeSvg(input.overallScore, 180)}
    </div>
    <div style="text-align:center;margin-bottom:32px">
      ${renderLevelBadge(input.readinessLevel)}
    </div>
  </div>

  <!-- ─── Executive Summary ───────────────────────────────── -->
  <div class="section page-break">
    <h2>Zusammenfassung</h2>
    ${renderParagraphs(input.reportTexts.executiveSummary)}
  </div>

  <!-- ─── Score Overview ──────────────────────────────────── -->
  <div class="section">
    <h2>Score-Übersicht</h2>
    <p style="margin-bottom:16px">
      Gesamtscore: <strong>${input.overallScore}/100</strong> — Level ${input.readinessLevel} (${levelName})
    </p>
    <h3>Kategorien</h3>
    ${renderCategoryBars(input.levelScores)}

    ${Object.entries(input.reportTexts.categoryAssessments)
			.map(([key, text]) => {
				const label = CATEGORY_LABELS[key as CheckCategory] ?? key;
				return `<div style="margin-top:12px"><h3>${escapeHtml(label)}</h3><p>${escapeHtml(text)}</p></div>`;
			})
			.join("\n")}
  </div>

  <!-- ─── Per-Check Details ───────────────────────────────── -->
  <div class="section page-break">
    <h2>Einzelprüfungen</h2>

    ${CATEGORY_ORDER.map((cat) => {
			const checks = grouped.get(cat) ?? [];
			if (checks.length === 0) return "";
			return `
    <h3 style="margin-top:20px;margin-bottom:12px;color:var(--brand-primary)">${CATEGORY_LABELS[cat]}</h3>
    ${checks
			.map(
				(check) => `
    <div class="check-card">
      ${renderScoreBar(escapeHtml(check.name), check.score, check.status)}
      ${
				input.reportTexts.checkSummaries[check.id]
					? `<p style="margin-top:8px">${escapeHtml(input.reportTexts.checkSummaries[check.id] as string)}</p>`
					: ""
			}
      ${
				check.issues.length > 0
					? `
      <ul style="list-style:none;padding:0;margin:8px 0 0">
        ${check.issues
					.map(
						(issue) => `
        <li style="font-size:13px;margin-bottom:4px;display:flex;align-items:flex-start;gap:6px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${SEVERITY_DOT_COLORS[issue.severity]};margin-top:5px;flex-shrink:0"></span>
          <span>${escapeHtml(issue.message)}</span>
        </li>`,
					)
					.join("\n")}
      </ul>`
					: ""
			}
    </div>`,
			)
			.join("\n")}`;
		}).join("\n")}
  </div>

  <!-- ─── Recommendations ─────────────────────────────────── -->
  ${
		input.reportTexts.recommendations.length > 0
			? `
  <div class="section page-break">
    <h2>Empfehlungen</h2>
    <ol style="padding-left:20px">
      ${input.reportTexts.recommendations
				.map(
					(rec, i) => `
      <li style="font-size:14px;margin-bottom:8px">
        <strong>${i + 1}.</strong> ${escapeHtml(rec)}
      </li>`,
				)
				.join("\n")}
    </ol>
  </div>`
			: ""
	}

  <!-- ─── Conclusion ──────────────────────────────────────── -->
  ${
		input.reportTexts.conclusion
			? `
  <div class="section">
    <h2>Fazit</h2>
    ${renderParagraphs(input.reportTexts.conclusion)}
  </div>`
			: ""
	}

  <!-- ─── Footer ──────────────────────────────────────────── -->
  <div class="report-footer" style="display:flex;justify-content:space-between">
    <span>${escapeHtml(branding.footerText ?? "Erstellt mit Beacon")}</span>
    <span>Generiert am ${now}</span>
  </div>

</div>
</body>
</html>`;
}
