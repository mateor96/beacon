import { AlertManager, type AlertView } from "@/components/alerts/alert-manager";
import { alertQueries, db } from "@beacon/db";
import { INSTANCE_USER_ID, UuidSchema } from "@beacon/shared";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
	params: Promise<{ id: string }>;
}

export default async function ProjectAlertsTab({ params }: Props) {
	const { id } = await params;
	if (!UuidSchema.safeParse(id).success) notFound();

	const rows = await alertQueries.getByUserId(db, INSTANCE_USER_ID);
	const alerts: AlertView[] = rows
		.map((a) => ({
			id: a.id,
			type: a.type,
			channel: a.channel,
			enabled: a.enabled ?? true,
			projectId: ((a.config ?? {}) as { projectId?: string }).projectId ?? null,
		}))
		.filter((a) => a.projectId === id);

	return (
		<section>
			<h2 className="mb-1 text-xl font-semibold text-text">Alerts</h2>
			<p className="mb-3 text-sm text-text-muted">
				Benachrichtigungen für dieses Projekt — bei Sichtbarkeitsverlust, neuen Citations oder wenn
				ein Wettbewerber zulegt.
			</p>
			<p className="mb-4 text-xs text-text-muted">
				Hinweis: Alerts werden gespeichert; die Zustellung erfolgt durch den Worker, sobald die
				Alert-Auswertung aktiviert ist.
			</p>
			<AlertManager alerts={alerts} projectId={id} />
		</section>
	);
}
