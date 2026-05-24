import { ApiTokenDisplay } from "@/components/admin/api-token-display";

export const dynamic = "force-dynamic";

export const metadata = {
	title: "API-Token",
	robots: { index: false, follow: false },
};

export default function AdminApiTokenPage() {
	const token = process.env.BEACON_API_TOKEN ?? "";
	const configured = token.length > 0;

	return (
		<main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
			<h1 className="text-3xl font-bold text-text">API-Token</h1>
			<p className="mt-2 text-text-muted">
				Beacon hat ein einzelnes instance-weites API-Token für die <code>/api/v1/*</code> Read-API.
				Das Token wird via <code>BEACON_API_TOKEN</code> env-Variable konfiguriert. Externe
				Integrationen (Looker Studio, n8n, eigene Skripte) authentifizieren sich mit{" "}
				<code>Authorization: Bearer &lt;token&gt;</code>.
			</p>

			{configured ? (
				<section className="mt-8 space-y-4">
					<div className="rounded-lg border border-border bg-surface p-4">
						<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
							Aktives Token
						</h2>
						<ApiTokenDisplay token={token} />
						<p className="mt-3 text-xs text-text-muted">
							Das Token lebt nur in der env-Variable. Beacon persistiert keinerlei API-Tokens in der
							Datenbank — Rotation bedeutet: <code>BEACON_API_TOKEN</code> umsetzen und den
							Webserver neu starten.
						</p>
					</div>

					<div className="rounded-lg border border-border bg-white p-4">
						<h3 className="text-sm font-semibold text-text">Test-Aufruf</h3>
						<pre className="mt-2 overflow-x-auto rounded bg-surface p-3 font-mono text-xs">
							{`curl -H "Authorization: Bearer ${token.slice(0, 8)}..." \\
  ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/monitoring/projects`}
						</pre>
					</div>
				</section>
			) : (
				<section className="mt-8 rounded-lg border border-warn bg-warn/10 p-6">
					<h2 className="text-lg font-semibold text-text">Token nicht konfiguriert</h2>
					<p className="mt-2 text-text-muted">
						<code>BEACON_API_TOKEN</code> ist nicht gesetzt. <code>/api/v1/*</code> Endpoints
						antworten aktuell mit <code>503 Service Unavailable</code>.
					</p>
					<ol className="mt-4 list-inside list-decimal space-y-1 text-sm text-text">
						<li>
							Token generieren: <code>openssl rand -hex 32</code>
						</li>
						<li>
							In <code>.env</code> eintragen: <code>BEACON_API_TOKEN=&lt;token&gt;</code>
						</li>
						<li>Webserver / Container neu starten</li>
						<li>Diese Seite neu laden</li>
					</ol>
				</section>
			)}
		</main>
	);
}
