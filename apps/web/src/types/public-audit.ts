export interface PublicAuditModelScore {
	checkId: string;
	name: string;
	score: number;
	status: string;
	summary: string;
}

export interface PublicAuditResult {
	overallScore: number;
	modelScores: PublicAuditModelScore[];
	summary: string | null;
}

interface PublicAuditBase {
	jobId: string;
	url: string;
	createdAt: string;
}

export interface PendingPublicAudit extends PublicAuditBase {
	status: "pending";
}
export interface ProcessingPublicAudit extends PublicAuditBase {
	status: "processing";
}
export interface CompletedPublicAudit extends PublicAuditBase {
	status: "completed";
	result: PublicAuditResult;
}
export interface FailedPublicAudit extends PublicAuditBase {
	status: "failed";
}

export type PublicAuditResponse =
	| PendingPublicAudit
	| ProcessingPublicAudit
	| CompletedPublicAudit
	| FailedPublicAudit;

export function isPollableAudit(
	a: PublicAuditResponse,
): a is PendingPublicAudit | ProcessingPublicAudit {
	return a.status === "pending" || a.status === "processing";
}

export function isCompletedAudit(a: PublicAuditResponse): a is CompletedPublicAudit {
	return a.status === "completed";
}
