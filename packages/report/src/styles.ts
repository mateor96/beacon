/**
 * CSS styles module for PDF report generation.
 * Returns a complete CSS string for embedding in <style> tags.
 */
export function getReportStyles(primaryColor: string, accentColor: string): string {
	return `
    :root {
      --primary: ${primaryColor};
      --accent: ${accentColor};
      --text: #1a1a1a;
      --text-muted: #6b7280;
      --bg: #ffffff;
      --bg-subtle: #f8fafc;
      --border: #e5e7eb;
      --pass: #16a34a;
      --warn: #d97706;
      --fail: #dc2626;
    }

    @page {
      size: A4;
      margin: 20mm 15mm;
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
      color: var(--text);
      background: var(--bg);
      line-height: 1.6;
      font-size: 14px;
    }

    /* ── Layout ─────────────────────────────────────── */

    .report-page {
      max-width: 720px;
      margin: 0 auto;
      padding: 40px 0;
    }

    .section {
      margin-bottom: 32px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--primary);
      color: var(--text);
    }

    .cover {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-height: 60vh;
      padding: 40px 0;
    }

    .cover h1 {
      font-size: 28px;
      color: var(--primary);
      margin: 0 0 8px;
    }

    .cover p {
      font-size: 16px;
      color: var(--text-muted);
      margin: 0 0 4px;
    }

    /* ── Check Cards ────────────────────────────────── */

    .check-card {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      background: var(--bg);
      page-break-inside: avoid;
    }

    .check-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }

    .check-header h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
    }

    .issue-list {
      list-style: none;
      padding: 0;
      margin: 8px 0 0;
    }

    .issue-item {
      position: relative;
      padding: 4px 0 4px 18px;
      font-size: 13px;
      color: var(--text);
    }

    .issue-item::before {
      content: "";
      position: absolute;
      left: 0;
      top: 10px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-muted);
    }

    .issue-item.critical::before { background: var(--fail); }
    .issue-item.important::before { background: var(--warn); }
    .issue-item.nice-to-have::before { background: var(--pass); }

    .recommendations-list {
      padding-left: 20px;
      margin: 8px 0 0;
    }

    .recommendations-list li {
      font-size: 13px;
      margin-bottom: 6px;
      color: var(--text);
    }

    /* ── Score Overview ─────────────────────────────── */

    .score-overview {
      display: flex;
      align-items: center;
      gap: 24px;
      margin-bottom: 24px;
    }

    /* ── Footer ─────────────────────────────────────── */

    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-muted);
      text-align: center;
    }

    /* ── Utility Classes ────────────────────────────── */

    .text-pass { color: var(--pass); }
    .text-warn { color: var(--warn); }
    .text-fail { color: var(--fail); }

    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
    }

    .page-break {
      page-break-before: always;
    }
  `;
}
