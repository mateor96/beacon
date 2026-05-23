import { forwardRef } from "react";

interface ScanPendingProps {
	url: string;
	status: string;
	elapsedMs: number;
}

export const ScanPending = forwardRef<HTMLHeadingElement, ScanPendingProps>(function ScanPending(
	{ url, status, elapsedMs },
	ref,
) {
	const elapsedSeconds = Math.floor(elapsedMs / 1000);
	const statusText =
		status === "processing" ? "Readiness-Checks laufen..." : "Website wird analysiert...";

	return (
		<div className="flex flex-col items-center justify-center py-16 text-center" aria-busy="true">
			{/* Spinner */}
			<div className="relative">
				<svg
					className="h-16 w-16 animate-spin text-primary"
					viewBox="0 0 24 24"
					fill="none"
					aria-hidden="true"
				>
					<circle
						className="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						strokeWidth="4"
					/>
					<path
						className="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					/>
				</svg>
				<div className="absolute inset-0 animate-[pulse-ring_2s_ease-in-out_infinite] rounded-full border-2 border-primary animate-pulse-ring" />
			</div>

			<h1 ref={ref} tabIndex={-1} className="mt-6 text-xl font-bold text-text outline-none">
				{statusText}
			</h1>

			<p className="mt-2 text-text-muted" aria-live="polite">
				<span className="font-mono">{url}</span>
			</p>

			{elapsedSeconds > 0 && (
				<p className="mt-4 text-sm text-text-muted">
					seit {elapsedSeconds} Sekunde{elapsedSeconds !== 1 ? "n" : ""}
				</p>
			)}

			<p className="mt-2 text-xs text-text-muted">Dies dauert in der Regel 5–15 Sekunden.</p>
		</div>
	);
});
