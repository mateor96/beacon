export default function ResultsLoading() {
	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<div className="h-8 w-64 animate-pulse rounded bg-border" />
			<div className="flex flex-col items-center gap-6 sm:flex-row">
				<div className="h-40 w-40 animate-pulse rounded-full bg-border" />
				<div className="flex-1 space-y-3">
					<div className="h-6 w-48 animate-pulse rounded bg-border" />
					<div className="h-4 w-32 animate-pulse rounded bg-border" />
					<div className="h-4 w-64 animate-pulse rounded bg-border" />
				</div>
			</div>
			<div className="space-y-4">
				<div className="h-16 animate-pulse rounded-lg bg-border" />
				<div className="h-16 animate-pulse rounded-lg bg-border" />
				<div className="h-16 animate-pulse rounded-lg bg-border" />
			</div>
		</div>
	);
}
