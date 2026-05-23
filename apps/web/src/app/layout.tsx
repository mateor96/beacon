import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: "Beacon — Agentic Web Readiness",
		template: "%s | Beacon",
	},
	description:
		"Lighthouse für Agentic Web Readiness. Prüfe ob deine Website für KI-Agenten bereit ist — mit automatischer Fix-Generierung.",
	openGraph: {
		type: "website",
		locale: "de_DE",
		url: SITE_URL,
		siteName: "Beacon — Agentic Web Readiness",
		title: "Beacon — Lighthouse für Agentic Web Readiness",
		description:
			"89% aller Websites sind unsichtbar für KI-Agenten. Beacon zeigt dir warum — und generiert die Fixes.",
	},
	twitter: {
		card: "summary_large_image",
		title: "Beacon — Agentic Web Readiness",
		description:
			"Prüfe ob deine Website für KI-Agenten bereit ist — mit automatischer Fix-Generierung.",
	},
	robots: {
		index: true,
		follow: true,
		googleBot: { index: true, follow: true },
	},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="de">
			<body className="bg-surface font-sans text-text antialiased">{children}</body>
		</html>
	);
}
