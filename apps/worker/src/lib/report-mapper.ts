import type { ValidatedReportTexts } from "@beacon/ai";
import type { ReportTexts } from "@beacon/shared";

export function flattenReportTexts(validated: ValidatedReportTexts): ReportTexts {
	return {
		executiveSummary: validated.executiveSummary,
		checkSummaries: Object.fromEntries(
			Object.entries(validated.checkSummaries).map(([id, s]) => [
				id,
				`${s.assessment} ${s.recommendation}`,
			]),
		),
		categoryAssessments: {
			readability: validated.categoryAssessments.readability.summary,
			interactivity: validated.categoryAssessments.interactivity.summary,
			...(validated.categoryAssessments.transactional && {
				transactional: validated.categoryAssessments.transactional.summary,
			}),
		},
		recommendations: validated.recommendations
			.sort((a, b) => a.priority - b.priority)
			.map((r) => `${r.title}: ${r.description}`),
		conclusion: validated.conclusion,
	};
}
