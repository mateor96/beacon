import { AlertManager, type AlertView } from "@/components/alerts/alert-manager";
import { alertQueries, db } from "@beacon/db";
import { INSTANCE_USER_ID } from "@beacon/shared";

export const dynamic = "force-dynamic";

export const metadata = {
	title: "Alerts",
};

export default async function AlertsPage() {
	const rows = await alertQueries.getByUserId(db, INSTANCE_USER_ID);
	const alerts: AlertView[] = rows.map((a) => ({
		id: a.id,
		type: a.type,
		channel: a.channel,
		enabled: a.enabled ?? true,
		projectId: ((a.config ?? {}) as { projectId?: string }).projectId ?? null,
	}));

	return (
		<main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
			<h1 className="text-3xl font-bold text-text">Alerts</h1>
			<p className="mt-2 text-text-muted">
				Alle konfigurierten Benachrichtigungen dieser Instanz. Neue Alerts legst du im jeweiligen
				Monitoring-Projekt unter dem Tab „Alerts“ an.
			</p>
			<div className="mt-8">
				<AlertManager alerts={alerts} />
			</div>
		</main>
	);
}
