"use client";

import { ScanPending } from "@/components/results/scan-pending";
import { useAuditPolling } from "@/hooks/use-audit-polling";
import { useTrackConversion } from "@/hooks/use-track-conversion";
import type { PublicAuditResponse } from "@/types/public-audit";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuditTeaserCompleted } from "./audit-teaser-completed";

interface AuditTeaserShellProps {
	initialAudit: PublicAuditResponse;
	jobId: string;
}

export function AuditTeaserShell({ initialAudit, jobId }: AuditTeaserShellProps) {
	const { audit, phase, elapsedMs } = useAuditPolling(jobId, initialAudit);
	const headingRef = useRef<HTMLHeadingElement>(null);
	const prevPhaseRef = useRef(phase);
	const [unlocked, setUnlocked] = useState(false);
	const [showEmailForm, setShowEmailForm] = useState(false);

	useTrackConversion(jobId, "teaser_viewed", phase === "completed");
	useTrackConversion(jobId, "report_viewed", unlocked);

	// Restore unlock state from localStorage
	useEffect(() => {
		try {
			if (localStorage.getItem(`awr_unlocked_${jobId}`) === "1") {
				setUnlocked(true);
			}
		} catch {}
	}, [jobId]);

	const handleUnlock = useCallback(() => {
		setUnlocked(true);
		setShowEmailForm(false);
		try {
			localStorage.setItem(`awr_unlocked_${jobId}`, "1");
		} catch {}
	}, [jobId]);

	// Focus heading on state transitions
	useEffect(() => {
		if (prevPhaseRef.current === "polling" && phase !== "polling") {
			headingRef.current?.focus();
		}
		prevPhaseRef.current = phase;
	}, [phase]);

	// Update document title dynamically
	useEffect(() => {
		if (phase === "polling") {
			document.title = "Audit läuft... | Beacon";
		} else if (phase === "completed" && audit.status === "completed") {
			document.title = `Beacon-Score: ${audit.result.overallScore}/100 | Beacon`;
		} else if (phase === "failed") {
			document.title = "Audit fehlgeschlagen | Beacon";
		} else if (phase === "timeout") {
			document.title = "Zeitüberschreitung | Beacon";
		} else if (phase === "error") {
			document.title = "Verbindungsfehler | Beacon";
		}
	}, [phase, audit]);

	return (
		<div>
			<div className="sr-only" aria-live="polite" aria-atomic="true">
				{phase === "polling" && "Audit läuft..."}
				{phase === "completed" && "Audit abgeschlossen"}
				{phase === "failed" && "Audit fehlgeschlagen"}
				{phase === "timeout" && "Zeitüberschreitung"}
				{phase === "error" && "Verbindungsfehler"}
			</div>

			{phase === "polling" && (
				<ScanPending ref={headingRef} url={audit.url} status={audit.status} elapsedMs={elapsedMs} />
			)}

			{phase === "completed" && audit.status === "completed" && (
				<AuditTeaserCompleted
					ref={headingRef}
					audit={audit}
					isUnlocked={unlocked}
					showEmailForm={showEmailForm}
					onCtaClick={() => setShowEmailForm(true)}
					onUnlocked={handleUnlock}
				/>
			)}

			{phase === "failed" && (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-text outline-none">
						Audit fehlgeschlagen
					</h1>
					<p className="mt-3 text-text-muted">Der Scan konnte nicht abgeschlossen werden.</p>
					<a
						href="/"
						className="mt-6 rounded-lg bg-primary px-6 py-3 font-medium text-text-inverse transition-colors hover:bg-primary-hover"
					>
						Erneut versuchen
					</a>
				</div>
			)}

			{phase === "timeout" && (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-text outline-none">
						Zeitüberschreitung
					</h1>
					<p className="mt-3 text-text-muted">
						Der Scan dauert ungewöhnlich lange. Bitte versuche es später erneut.
					</p>
					<a
						href={`/audit/${jobId}`}
						className="mt-6 rounded-lg bg-primary px-6 py-3 font-medium text-text-inverse transition-colors hover:bg-primary-hover"
					>
						Seite neu laden
					</a>
				</div>
			)}

			{phase === "error" && (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-text outline-none">
						Verbindungsfehler
					</h1>
					<p className="mt-3 text-text-muted">Die Verbindung zum Server wurde unterbrochen.</p>
					<a
						href={`/audit/${jobId}`}
						className="mt-6 rounded-lg bg-primary px-6 py-3 font-medium text-text-inverse transition-colors hover:bg-primary-hover"
					>
						Erneut versuchen
					</a>
				</div>
			)}
		</div>
	);
}
