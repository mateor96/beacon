import { AuditTeaserShell } from "@/components/audit/audit-teaser-shell";
import type { CompletedPublicAudit, PublicAuditResponse } from "@/types/public-audit";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
	params: Promise<{ jobId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { jobId } = await params;

	const { UuidSchema } = await import("@beacon/shared");
	const parseResult = UuidSchema.safeParse(jobId);
	if (!parseResult.success) {
		return notFound();
	}

	const { db, publicAuditQueries } = await import("@beacon/db");
	const request = await publicAuditQueries.getRequestById(db, parseResult.data);

	if (!request) {
		return notFound();
	}

	if (request.status === "completed") {
		const result = await publicAuditQueries.getResultByRequestId(db, parseResult.data);
		const hostname = request.url ? new URL(request.url).hostname : request.url;
		const score = result?.overallScore ?? 0;
		const title = `Beacon-Score: ${score}/100 für ${hostname} | Beacon`;
		const description = `KI-Sichtbarkeits-Bewertung für ${hostname}: Score ${score}/100. Kostenloser Check für ChatGPT, Perplexity, Claude und Gemini.`;
		const ogUrl = `/api/og?score=${score}&domain=${encodeURIComponent(hostname ?? "")}`;
		return {
			title,
			description,
			robots: { index: true, follow: true },
			openGraph: {
				type: "article",
				locale: "de_DE",
				title,
				description,
				images: [{ url: ogUrl, width: 1200, height: 630, alt: title }],
			},
			twitter: {
				card: "summary_large_image",
				title,
				description,
				images: [ogUrl],
			},
		};
	}

	if (request.status === "pending" || request.status === "processing") {
		return {
			title: "Audit läuft... | Beacon",
			robots: { index: false, follow: false },
		};
	}

	// failed
	return {
		title: "Audit fehlgeschlagen | Beacon",
		robots: { index: false, follow: false },
	};
}

export default async function AuditPage({ params }: Props) {
	const { jobId } = await params;

	const { UuidSchema } = await import("@beacon/shared");
	const parseResult = UuidSchema.safeParse(jobId);
	if (!parseResult.success) {
		notFound();
	}

	const { db, publicAuditQueries } = await import("@beacon/db");
	const request = await publicAuditQueries.getRequestById(db, parseResult.data);

	if (!request) {
		notFound();
	}

	let data: PublicAuditResponse;

	if (request.status === "completed") {
		const result = await publicAuditQueries.getResultByRequestId(db, parseResult.data);

		data = {
			status: "completed",
			jobId: parseResult.data,
			url: request.url,
			createdAt: request.createdAt?.toISOString() ?? new Date().toISOString(),
			result: {
				overallScore: result?.overallScore ?? 0,
				modelScores: (result?.modelScores as CompletedPublicAudit["result"]["modelScores"]) ?? [],
				summary: result?.summary ?? null,
			},
		} satisfies CompletedPublicAudit;
	} else {
		data = {
			status: request.status as "pending" | "processing" | "failed",
			jobId: parseResult.data,
			url: request.url,
			createdAt: request.createdAt?.toISOString() ?? new Date().toISOString(),
		};
	}

	return <AuditTeaserShell initialAudit={data} jobId={jobId} />;
}
