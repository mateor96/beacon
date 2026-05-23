import { ScoreRing } from "@/components/results/score-ring";
import { extractHostname, getScoreRating } from "@/lib/format";
import type { CompletedPublicAudit, PublicAuditModelScore } from "@/types/public-audit";
import { LEVEL_NAMES, scoreToLevel } from "@beacon/shared";
import type { ReadinessLevel } from "@beacon/shared";
import { forwardRef } from "react";
import { EmailCaptureForm } from "./email-capture-form";

interface AuditTeaserCompletedProps {
	audit: CompletedPublicAudit;
	isUnlocked: boolean;
	showEmailForm: boolean;
	onCtaClick: () => void;
	onUnlocked: () => void;
}

const FREE_CHECK_IDS = ["robots-txt", "meta-tags"];

function getStatusIcon(status: string) {
	if (status === "pass") {
		return (
			<span className="text-green-500" aria-label="Bestanden">
				&#x2713;
			</span>
		);
	}
	if (status === "warn") {
		return (
			<span className="text-yellow-500" aria-label="Warnung">
				!
			</span>
		);
	}
	return (
		<span className="text-red-500" aria-label="Fehlgeschlagen">
			&#x2717;
		</span>
	);
}

function CheckCard({ check, locked }: { check: PublicAuditModelScore; locked: boolean }) {
	return (
		<div className="relative rounded-xl border border-border">
			<div
				className={`p-4 transition-[filter] duration-500 ease-out ${locked ? "pointer-events-none select-none" : ""}`}
				style={{ filter: locked ? "blur(6px)" : "none" }}
			>
				<div className="flex items-center gap-3">
					<span className="text-lg font-bold">{getStatusIcon(check.status)}</span>
					<div className="flex-1">
						<div className="flex items-center justify-between">
							<span className="font-medium text-text">{check.name}</span>
							<span className="text-sm font-mono text-text-muted">{check.score}/100</span>
						</div>
						<p className="mt-1 text-sm text-text-muted">{check.summary}</p>
					</div>
				</div>
			</div>
			<div
				className={`absolute inset-0 flex items-center justify-center rounded-xl bg-surface/60 transition-opacity duration-500 ${locked ? "opacity-100" : "opacity-0 pointer-events-none"}`}
			>
				<svg
					className="h-5 w-5 text-text-muted"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
					role="img"
				>
					<title>Gesperrt</title>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
					/>
				</svg>
			</div>
		</div>
	);
}

export const AuditTeaserCompleted = forwardRef<HTMLHeadingElement, AuditTeaserCompletedProps>(
	function AuditTeaserCompleted({ audit, isUnlocked, showEmailForm, onCtaClick, onUnlocked }, ref) {
		const level = scoreToLevel(audit.result.overallScore);
		const levelName = LEVEL_NAMES[level as ReadinessLevel] ?? "Unbekannt";
		const rating = getScoreRating(audit.result.overallScore);

		return (
			<div className="mx-auto max-w-4xl">
				{/* Header */}
				<div className="mb-8">
					<h1 ref={ref} tabIndex={-1} className="text-2xl font-bold text-text outline-none">
						{extractHostname(audit.url)}
					</h1>
				</div>

				{/* Score + Level */}
				<div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
					<ScoreRing score={audit.result.overallScore} level={level} levelName={levelName} />
					<div className="flex-1 text-center sm:text-left">
						<p className="text-lg font-semibold text-text">
							Stufe {level}: {levelName}
						</p>
						<p className="mt-1 text-text-muted">{rating}</p>
						{audit.result.summary && (
							<p className="mt-3 text-sm text-text-muted">{audit.result.summary}</p>
						)}
					</div>
				</div>

				{/* Checks */}
				<div className="mt-8">
					<h2 className="mb-4 text-xl font-bold text-text">Ergebnisse</h2>
					<div className="space-y-3">
						{audit.result.modelScores.map((check) => (
							<CheckCard
								key={check.checkId}
								check={check}
								locked={!isUnlocked && !FREE_CHECK_IDS.includes(check.checkId)}
							/>
						))}
					</div>
				</div>

				{/* CTA section */}
				{!isUnlocked && (
					<div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
						<h2 className="text-lg font-semibold text-text">Vollständigen Report freischalten</h2>
						<p className="mt-2 text-sm text-text-muted">
							Erhalte detaillierte Empfehlungen, KI-generierte Fixes und einen PDF-Report für deine
							Website.
						</p>
						{showEmailForm ? (
							<div className="mt-4">
								<EmailCaptureForm jobId={audit.jobId} onUnlocked={onUnlocked} />
							</div>
						) : (
							<button
								type="button"
								onClick={onCtaClick}
								className="mt-4 inline-block rounded-lg bg-primary px-6 py-3 font-medium text-text-inverse transition-colors hover:bg-primary-hover"
							>
								Report freischalten
							</button>
						)}
					</div>
				)}

				{isUnlocked && (
					<div className="mt-8 rounded-xl border border-border bg-surface p-6 text-center">
						<a
							href="/signup"
							className="inline-block rounded-lg bg-primary px-6 py-3 font-medium text-text-inverse transition-colors hover:bg-primary-hover"
						>
							Jetzt registrieren
						</a>
					</div>
				)}
			</div>
		);
	},
);
