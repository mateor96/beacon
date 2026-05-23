"use client";

import Link from "next/link";

interface ErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function ResultsError({ error, reset }: ErrorProps) {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
			<h1 className="text-2xl font-bold text-text">Etwas ist schiefgelaufen</h1>
			<p className="mt-3 max-w-md text-text-muted">
				Beim Laden der Ergebnisse ist ein Fehler aufgetreten. Bitte versuche es erneut.
			</p>
			{error.digest && <p className="mt-2 text-xs text-text-muted">Fehler-ID: {error.digest}</p>}
			<div className="mt-6 flex gap-3">
				<button
					type="button"
					onClick={reset}
					className="rounded-lg bg-primary px-6 py-3 font-medium text-text-inverse transition-colors hover:bg-primary-hover"
				>
					Erneut versuchen
				</button>
				<Link
					href="/"
					className="rounded-lg border border-border px-6 py-3 font-medium text-text transition-colors hover:bg-surface-alt"
				>
					Zur Startseite
				</Link>
			</div>
		</div>
	);
}
