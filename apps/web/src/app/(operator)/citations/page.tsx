export const metadata = {
	title: "Citations",
};

export default function CitationsPage() {
	return (
		<main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
			<h1 className="text-3xl font-bold text-text">Citations</h1>
			<p className="mt-2 text-text-muted">
				Welche Seiten deiner Domain von AI-Engines zitiert werden — instance-weit.
			</p>
			<div className="mt-8 rounded-lg border border-border bg-surface p-12 text-center">
				<p className="text-text-muted">
					Die Citation-Übersicht wird in einer späteren Ausbaustufe ergänzt.
				</p>
			</div>
		</main>
	);
}
