import { formatRelativeTime } from "@/lib/format";
import type { FailedScanResponse } from "@/types/scan-api";
import Link from "next/link";
import { forwardRef } from "react";

interface ScanFailedProps {
	scan: FailedScanResponse;
	scanId: string;
}

export const ScanFailed = forwardRef<HTMLHeadingElement, ScanFailedProps>(function ScanFailed(
	{ scan, scanId },
	ref,
) {
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
				<svg
					className="h-8 w-8 text-danger"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
					aria-hidden="true"
				>
					<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</div>

			<h1 ref={ref} tabIndex={-1} className="mt-6 text-2xl font-bold text-text outline-none">
				Scan fehlgeschlagen
			</h1>

			<p className="mt-3 max-w-md text-text-muted">{scan.error}</p>

			<p className="mt-2 text-xs text-text-muted">{formatRelativeTime(new Date(scan.scannedAt))}</p>

			<div className="mt-6 flex gap-3">
				<Link
					href="/"
					className="rounded-lg bg-primary px-6 py-3 font-medium text-text-inverse transition-colors hover:bg-primary-hover"
				>
					Erneut scannen
				</Link>
				<Link
					href="/"
					className="rounded-lg border border-border px-6 py-3 font-medium text-text transition-colors hover:bg-surface-alt"
				>
					Zur Startseite
				</Link>
			</div>
		</div>
	);
});
