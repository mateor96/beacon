export type TemplateName =
	| "scan-complete"
	| "welcome"
	| "audit-report-ready"
	| "alert-notification"
	| "validation-failed"
	| "milestone-notification"
	| "roi-report-ready";

export interface TemplateDataMap {
	"scan-complete": { scanId: string; url: string; score: number; reportUrl: string };
	welcome: { fullName: string; loginUrl: string };
	"audit-report-ready": { url: string; score: number; reportUrl: string };
	"alert-notification": {
		alertType: string;
		brandName: string;
		projectName: string;
		summary: string;
		currentValue: number | string;
		previousValue: number | string;
		dashboardUrl: string;
	};
	"validation-failed": {
		fixType: string;
		siteUrl: string;
		checksFailed: string[];
		dashboardUrl: string;
	};
	"milestone-notification": {
		milestoneType: string;
		projectName: string;
		description: string;
		currentValue: number | string;
		previousValue: number | string;
		dashboardUrl: string;
	};
	"roi-report-ready": {
		projectName: string;
		currentScore: number;
		baselineScore: number;
		scoreDelta: number;
		reportUrl: string;
	};
}

export interface RenderedEmail {
	subject: string;
	html: string;
	text: string;
}

export type TemplateRenderer<T extends TemplateName> = (
	data: TemplateDataMap[T],
	unsubscribeUrl: string,
) => RenderedEmail;
