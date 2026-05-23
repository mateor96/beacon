import { ResultsShell } from "@/components/results/results-shell";
import { normalizeAccessToken } from "@/lib/scan-access";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getScan } from "./get-scan";

export const dynamic = "force-dynamic";

interface Props {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ access?: string | string[] }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
	const { id } = await params;
	const { access } = await searchParams;
	const result = await getScan(id, access);

	if (!result) {
		return {
			title: "Scan nicht gefunden",
			robots: { index: false, follow: false },
			referrer: "same-origin",
		};
	}

	const { scan } = result;
	let title = "Scan-Ergebnis";
	if (scan.status === "pending" || scan.status === "processing") {
		title = "Scan läuft...";
	} else if (scan.status === "completed") {
		title = `Beacon-Score: ${scan.score}/100`;
	} else if (scan.status === "failed") {
		title = "Scan fehlgeschlagen";
	}

	return {
		title,
		robots: { index: false, follow: false },
		referrer: "same-origin",
	};
}

export default async function ResultsPage({ params, searchParams }: Props) {
	const { id } = await params;
	const { access } = await searchParams;
	const result = await getScan(id, access);

	if (!result) notFound();

	return (
		<ResultsShell
			initialScan={result.scan}
			scanId={id}
			accessMode={result.accessMode}
			accessToken={normalizeAccessToken(access)}
		/>
	);
}
