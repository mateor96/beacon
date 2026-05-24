export const metadata = {
	title: "Status & Health",
};

export default function StatusPage() {
	return (
		<main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
			<h1 className="text-3xl font-bold text-text">Status &amp; Health</h1>
			<p className="mt-2 text-text-muted">
				Konfigurierte Provider-Keys, Queue-Health, Dead-Letter-Queue und E-Mail-Log.
			</p>
			<div className="mt-8 rounded-lg border border-border bg-surface p-12 text-center">
				<p className="text-text-muted">
					Die Status-Übersicht wird in einer späteren Ausbaustufe ergänzt.
				</p>
			</div>
		</main>
	);
}
