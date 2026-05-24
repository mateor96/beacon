import { DeleteConnectionButton } from "@/components/cms-connections/delete-button";
import { db, fixQueries } from "@beacon/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
	title: "CMS-Verbindungen",
	robots: { index: false, follow: false },
};

const CMS_LABELS: Record<string, string> = {
	wordpress: "WordPress",
	webflow: "Webflow",
	shopify: "Shopify",
};

export default async function CmsConnectionsIndexPage() {
	const connections = await fixQueries.listCmsConnections(db);

	return (
		<main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
			<div className="mb-8 flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold text-text">CMS-Verbindungen</h1>
					<p className="mt-2 text-text-muted">
						Hinterlegte Zugangsdaten für WordPress, Webflow und Shopify. Credentials werden mit{" "}
						<code>CMS_CREDENTIALS_KEY</code> AES-256-GCM-verschlüsselt gespeichert und nie über die
						API zurückgegeben.
					</p>
				</div>
				<Link
					href="/cms-connections/new"
					className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover"
				>
					Neue Verbindung
				</Link>
			</div>

			{connections.length === 0 ? (
				<div className="rounded-lg border border-border bg-surface p-12 text-center">
					<p className="text-text-muted">
						Noch keine CMS-Verbindungen. Lege eine an, um generierte Fixes direkt in deinen
						Shop/Blog pushen zu können.
					</p>
				</div>
			) : (
				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full text-sm">
						<thead className="bg-surface text-left text-text-muted">
							<tr>
								<th className="px-4 py-3 font-medium">CMS</th>
								<th className="px-4 py-3 font-medium">Site</th>
								<th className="px-4 py-3 font-medium">Label</th>
								<th className="px-4 py-3 font-medium">Zuletzt verwendet</th>
								<th className="px-4 py-3 text-right" />
							</tr>
						</thead>
						<tbody className="divide-y divide-border bg-white">
							{connections.map((c) => (
								<tr key={c.id}>
									<td className="px-4 py-3 font-medium text-text">
										{CMS_LABELS[c.cmsType] ?? c.cmsType}
									</td>
									<td className="px-4 py-3 text-text-muted">{c.siteUrl}</td>
									<td className="px-4 py-3 text-text-muted">{c.label ?? "—"}</td>
									<td className="px-4 py-3 text-text-muted">
										{c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleDateString("de-DE") : "—"}
									</td>
									<td className="px-4 py-3 text-right">
										<DeleteConnectionButton id={c.id} label={c.label ?? c.siteUrl} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</main>
	);
}
