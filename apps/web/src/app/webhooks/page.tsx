import { WebhookListClient } from "@/components/webhooks/list-client";
import { WEBHOOK_EVENT_NAMES } from "@beacon/api-sdk";
import { db, webhookQueries } from "@beacon/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
	title: "Webhooks",
	robots: { index: false, follow: false },
};

export default async function WebhooksIndexPage() {
	const endpoints = await webhookQueries.listAll(db);
	const serialised = endpoints.map((e) => ({
		id: e.id,
		url: e.url,
		events: e.events,
		active: e.active,
		createdAt: e.createdAt.toISOString(),
	}));

	return (
		<main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
			<div className="mb-8 flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold text-text">Webhooks</h1>
					<p className="mt-2 text-text-muted">
						Outbound-Endpoints für Scan-, Fix- und Deploy-Events. Das Secret wird
						AES-256-GCM-verschlüsselt mit <code>CMS_CREDENTIALS_KEY</code> gespeichert und nur beim
						Anlegen einmal im Klartext zurückgegeben.
					</p>
				</div>
				<Link
					href="/webhooks/new"
					className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover"
				>
					Neuer Webhook
				</Link>
			</div>

			<p className="mb-4 text-xs text-text-muted">
				Verfügbare Events: {WEBHOOK_EVENT_NAMES.join(", ")}
			</p>

			<WebhookListClient endpoints={serialised} />
		</main>
	);
}
