export const REPORT_VERSION = "0.1.0" as const;

// Types
export type {
	ReportInput,
	PdfOptions,
	ReportOutput,
	RoiReportInput,
	RoiReportOutput,
	RoiSnapshotPoint,
	RoiCitationChange,
	RoiMilestoneEntry,
} from "./types.js";

// Branding
export { DEFAULT_BRANDING, mergeBranding } from "./branding.js";

// Template
export { renderHtml } from "./template.js";

// Styles
export { getReportStyles } from "./styles.js";

// ROI Report (#281)
export { renderRoiHtml } from "./roi-template.js";
export { renderTimelineSvg, renderDeltaArrowSvg } from "./roi-charts.js";

// Competitive section (#242)
export {
	renderCompetitiveSection,
	type CompetitiveSectionInput,
	type CompetitiveSectionRow,
} from "./competitive-section.js";

// Locale comparison section (#241)
export { renderLocaleSection } from "./locale-section.js";
export type { LocaleSectionInput, LocaleSectionRow } from "./locale-section.js";

// PDF
export { renderPdf, closeBrowser, generateReport } from "./pdf.js";
export {
	STATUS_COLORS,
	LEVEL_COLORS,
	scoreToColor,
	statusToColor,
	renderGaugeSvg,
	renderLevelBadge,
	renderScoreBar,
	renderCategoryBars,
	renderLevelBreakdown,
} from "./scores.js";
