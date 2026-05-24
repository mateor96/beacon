import { NewCmsConnectionForm } from "@/components/cms-connections/new-connection-form";

export const metadata = {
	title: "Neue CMS-Verbindung",
	robots: { index: false, follow: false },
};

export default function NewCmsConnectionPage() {
	return (
		<main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
			<h1 className="text-3xl font-bold text-text">Neue CMS-Verbindung</h1>
			<p className="mt-2 text-text-muted">
				Beacon kann generierte Fixes direkt in dein CMS pushen. Zugangsdaten werden
				AES-256-GCM-verschlüsselt mit dem instance-weiten <code>CMS_CREDENTIALS_KEY</code> abgelegt
				und nie über die API zurückgegeben.
			</p>

			<div className="mt-8">
				<NewCmsConnectionForm />
			</div>
		</main>
	);
}
