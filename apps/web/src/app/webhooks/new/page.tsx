import { NewWebhookForm } from "@/components/webhooks/new-form";
import { WEBHOOK_EVENT_NAMES } from "@beacon/api-sdk";

export const metadata = {
	title: "Neuer Webhook",
	robots: { index: false, follow: false },
};

export default function NewWebhookPage() {
	return (
		<main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
			<h1 className="text-3xl font-bold text-text">Neuer Webhook</h1>
			<p className="mt-2 text-text-muted">
				Beacon sendet Events an deine URL mit einer <code>X-Beacon-Signature</code> Header
				(HMAC-SHA256). Das Secret wird beim Speichern <strong>einmalig</strong> angezeigt; merke es
				dir.
			</p>

			<div className="mt-8">
				<NewWebhookForm eventNames={[...WEBHOOK_EVENT_NAMES]} />
			</div>
		</main>
	);
}
