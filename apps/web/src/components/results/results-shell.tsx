"use client";

import { useScanPolling } from "@/hooks/use-scan-polling";
import type { AccessMode } from "@/lib/scan-access";
import type { ScanResponse } from "@/types/scan-api";
import { useEffect, useRef } from "react";
import { ScanCompleted } from "./scan-completed";
import { ScanFailed } from "./scan-failed";
import { ScanPending } from "./scan-pending";

interface ResultsShellProps {
	initialScan: ScanResponse;
	scanId: string;
	accessMode: AccessMode;
	accessToken?: string;
}

export function ResultsShell({ initialScan, scanId, accessMode, accessToken }: ResultsShellProps) {
	const { scan, phase, elapsedMs } = useScanPolling(scanId, initialScan, accessToken);
	const headingRef = useRef<HTMLHeadingElement>(null);
	const prevPhaseRef = useRef(phase);

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
			document.title = "Scan läuft... | Beacon";
		} else if (phase === "completed" && scan.status === "completed") {
			document.title = `Beacon-Score: ${scan.score}/100 | Beacon`;
		} else if (phase === "failed") {
			document.title = "Scan fehlgeschlagen | Beacon";
		} else if (phase === "timeout") {
			document.title = "Zeitüberschreitung | Beacon";
		} else if (phase === "error") {
			document.title = "Verbindungsfehler | Beacon";
		}
	}, [phase, scan]);

	const reloadHref = accessToken
		? `/results/${scanId}?access=${accessToken}`
		: `/results/${scanId}`;

	return (
		<div>
			<div className="sr-only" aria-live="polite" aria-atomic="true">
				{phase === "polling" && "Scan läuft..."}
				{phase === "completed" && "Scan abgeschlossen"}
				{phase === "failed" && "Scan fehlgeschlagen"}
				{phase === "timeout" && "Zeitüberschreitung"}
				{phase === "error" && "Verbindungsfehler"}
			</div>

			{phase === "polling" && (
				<ScanPending ref={headingRef} url={scan.url} status={scan.status} elapsedMs={elapsedMs} />
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
						href={reloadHref}
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
						href={reloadHref}
						className="mt-6 rounded-lg bg-primary px-6 py-3 font-medium text-text-inverse transition-colors hover:bg-primary-hover"
					>
						Erneut versuchen
					</a>
				</div>
			)}

			{phase === "completed" && scan.status === "completed" && (
				<ScanCompleted ref={headingRef} scan={scan} accessMode={accessMode} />
			)}

			{phase === "failed" && scan.status === "failed" && (
				<ScanFailed ref={headingRef} scan={scan} scanId={scanId} />
			)}
		</div>
	);
}
