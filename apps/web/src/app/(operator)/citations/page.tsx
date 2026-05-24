import { CitationOverview, type CitationRow } from "@/components/citations/citation-overview";
import { citationQueries, db } from "@beacon/db";

export const dynamic = "force-dynamic";

export const metadata = {
	title: "Citations",
};

function parseDays(value: string | string[] | undefined): 30 | 60 | 90 {
	const n = Number(Array.isArray(value) ? value[0] : value);
	return n === 60 || n === 90 ? n : 30;
}

export default async function CitationsPage({
	searchParams,
}: {
	searchParams: Promise<{ days?: string }>;
}) {
	const { days: daysParam } = await searchParams;
	const days = parseDays(daysParam);

	const [stats, recentRaw] = await Promise.all([
		citationQueries.getCitationStatsForInstance(db, days),
		citationQueries.listCitationsForInstance(db, { limit: 25 }),
	]);

	const recent: CitationRow[] = recentRaw.map((r) => ({
		id: r.id,
		modelName: r.modelName,
		queryText: r.queryText,
		extractedAt:
			r.extractedAt instanceof Date ? r.extractedAt.toISOString() : String(r.extractedAt),
	}));

	return (
		<main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
			<h1 className="text-3xl font-bold text-text">Citations</h1>
			<p className="mt-2 text-text-muted">
				Welche Seiten deiner Domain von AI-Engines zitiert werden — instance-weit über alle Scans
				und Crawls.
			</p>
			<div className="mt-8">
				<CitationOverview stats={stats} recent={recent} days={days} />
			</div>
		</main>
	);
}
