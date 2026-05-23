import type { LevelScores, ScanCheck } from "@beacon/shared";

interface ScanResponseBase {
	id: string;
	url: string;
	scannedAt: string;
}

export interface PendingScanResponse extends ScanResponseBase {
	status: "pending";
}

export interface ProcessingScanResponse extends ScanResponseBase {
	status: "processing";
}

export interface CompletedScanResponse extends ScanResponseBase {
	status: "completed";
	finalUrl: string | null;
	score: number;
	readinessLevel: number;
	levelScores: LevelScores;
	checks: ScanCheck[];
	fixes: Record<
		string,
		{ checkId: string; content: string; filename: string; method: string }
	> | null;
	processingDurationMs: number | null;
	completedAt: string | null;
	actions: {
		analysis: string;
		detail: string;
		fix: string;
	} | null;
}

export interface FailedScanResponse extends ScanResponseBase {
	status: "failed";
	error: string;
}

export type ScanResponse =
	| PendingScanResponse
	| ProcessingScanResponse
	| CompletedScanResponse
	| FailedScanResponse;

export function isCompletedScan(s: ScanResponse): s is CompletedScanResponse {
	return s.status === "completed";
}

export function isFailedScan(s: ScanResponse): s is FailedScanResponse {
	return s.status === "failed";
}

export function isPollable(s: ScanResponse): s is PendingScanResponse | ProcessingScanResponse {
	return s.status === "pending" || s.status === "processing";
}
