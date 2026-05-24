import {
	CompetitorManager,
	type CompetitorView,
} from "@/components/competitors/competitor-manager";
import { competitorQueries, db } from "@beacon/db";
import { UuidSchema } from "@beacon/shared";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
	params: Promise<{ id: string }>;
}

export default async function CompetitorsTab({ params }: Props) {
	const { id } = await params;
	if (!UuidSchema.safeParse(id).success) notFound();

	const competitors = (await competitorQueries.getCompetitorsWithLatestBenchmarks(
		db,
		id,
	)) as CompetitorView[];

	return (
		<section>
			<h2 className="mb-1 text-xl font-semibold text-text">Wettbewerber</h2>
			<p className="mb-4 text-sm text-text-muted">
				Vergleiche Share-of-Voice, Sentiment und Ranking deiner Brand gegen registrierte
				Wettbewerber. Benchmarks werden beim AI-Visibility-Sweep erzeugt.
			</p>
			<CompetitorManager projectId={id} competitors={competitors} />
		</section>
	);
}
