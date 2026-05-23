import {
	AuditFaq,
	AuditForm,
	AuditHero,
	AuditJsonLd,
	Cta,
	Footer,
	HowItWorks,
	Navbar,
	SocialProof,
} from "@/components/landing";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Kostenloser KI-Sichtbarkeit-Check",
	description:
		"Prüfe kostenlos ob deine Website für KI-Agenten wie ChatGPT, Perplexity und Claude sichtbar ist. 10 Checks, sofort Ergebnisse, keine Anmeldung noetig.",
	openGraph: {
		type: "website",
		locale: "de_DE",
		title: "Kostenloser KI-Sichtbarkeit-Check | Beacon",
		description: "Ist deine Website unsichtbar für KI-Agenten? Finde es in 30 Sekunden heraus.",
	},
};

export default function AuditPage() {
	return (
		<>
			<AuditJsonLd />
			<Navbar />
			<AuditHero>
				<AuditForm variant="hero" />
			</AuditHero>
			<SocialProof />
			<HowItWorks />
			<AuditFaq />
			<Cta>
				<AuditForm variant="compact" />
			</Cta>
			<Footer />
		</>
	);
}
