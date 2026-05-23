import Link from "next/link";

export default function ScanNotFound() {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
			<h1 className="text-2xl font-bold text-text">Scan nicht gefunden</h1>
			<p className="mt-3 max-w-md text-text-muted">
				Dieser Scan existiert nicht oder wurde nach Ablauf der Aufbewahrungsfrist gelöscht.
			</p>
			<Link
				href="/"
				className="mt-6 rounded-lg bg-primary px-6 py-3 font-medium text-text-inverse transition-colors hover:bg-primary-hover"
			>
				Zur Startseite
			</Link>
		</div>
	);
}
