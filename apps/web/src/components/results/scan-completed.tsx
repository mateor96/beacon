import {
	CATEGORY_LABELS,
	extractHostname,
	formatDuration,
	formatRelativeTime,
	getScoreRating,
} from "@/lib/format";
import type { AccessMode } from "@/lib/scan-access";
import type { CompletedScanResponse } from "@/types/scan-api";
import { LEVEL_NAMES } from "@beacon/shared";
import type { ReadinessLevel } from "@beacon/shared";
import { forwardRef } from "react";
import { CheckList } from "./check-list";
import { ScoreRing } from "./score-ring";

interface ScanCompletedProps {
	scan: CompletedScanResponse;
	accessMode: AccessMode;
}

export const ScanCompleted = forwardRef<HTMLHeadingElement, ScanCompletedProps>(
	function ScanCompleted({ scan, accessMode }, ref) {
		const levelName = LEVEL_NAMES[scan.readinessLevel as ReadinessLevel] ?? "Unbekannt";
		const rating = getScoreRating(scan.score);

		return (
			<div className="mx-auto max-w-4xl">
				{/* Header */}
				<div className="mb-8">
					<h1 ref={ref} tabIndex={-1} className="text-2xl font-bold text-text outline-none">
						{extractHostname(scan.url)}
					</h1>
					<div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-text-muted">
						<span>{formatRelativeTime(new Date(scan.scannedAt))}</span>
						{scan.processingDurationMs != null && (
							<span>&middot; {formatDuration(scan.processingDurationMs)}</span>
						)}
					</div>
				</div>

				{/* Score + Level */}
				<div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
					<ScoreRing score={scan.score} level={scan.readinessLevel} levelName={levelName} />
					<div className="flex-1 text-center sm:text-left">
						<p className="text-lg font-semibold text-text">
							Stufe {scan.readinessLevel}: {levelName}
						</p>
						<p className="mt-1 text-text-muted">{rating}</p>

						{/* Level score bars */}
						<div className="mt-4 space-y-2">
							{(["readability", "interactivity", "transactional"] as const)
								.flatMap((cat) => {
									const value = scan.levelScores[cat];
									return value == null ? [] : [{ cat, value }];
								})
								.map(({ cat, value }) => (
									<div key={cat} className="flex items-center gap-3">
										<span className="w-28 text-sm text-text-muted">{CATEGORY_LABELS[cat]}</span>
										<div className="h-2 flex-1 rounded-full bg-border">
											<div
												className="h-2 rounded-full bg-primary transition-all duration-700"
												style={{
													width: `${Math.min(100, Math.max(0, value))}%`,
												}}
											/>
										</div>
										<span className="w-8 text-right text-xs font-mono text-text-muted">
											{Math.round(value)}%
										</span>
									</div>
								))}
						</div>
					</div>
				</div>

				{/* Upgrade CTA for non-owner visitors (anonymous / free users viewing via token) */}
				{accessMode !== "owner" && (
					<div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
						<h2 className="text-lg font-semibold text-text">Mehr aus deiner Analyse herausholen</h2>
						<p className="mt-2 text-sm text-text-muted">
							Mit einem Beacon-Plan erhältst du Zugang zum Dashboard, PDF-Reports, automatische
							Fix-Generierung und KI-Analyse.
						</p>
						<div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
							<a
								href="/pricing"
								className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover"
							>
								Plaene ansehen
							</a>
							<a
								href="/signup"
								className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-text transition-colors hover:border-primary hover:text-primary"
							>
								Kostenlos registrieren
							</a>
						</div>
					</div>
				)}

				{/* Action links — owner only */}
				{accessMode === "owner" && (
					<div className="mt-8 flex flex-wrap gap-3">
						<a
							href={`/dashboard/scans/${scan.id}`}
							className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:bg-surface-alt hover:text-text"
						>
							KI-Analyse &amp; PDF-Report
						</a>
					</div>
				)}

				{/* Check list */}
				<div className="mt-8">
					<h2 className="mb-4 text-xl font-bold text-text">Checks</h2>
					<CheckList
						checks={scan.checks}
						fixes={scan.fixes}
						scanId={scan.id}
						accessMode={accessMode}
					/>
				</div>
			</div>
		);
	},
);
