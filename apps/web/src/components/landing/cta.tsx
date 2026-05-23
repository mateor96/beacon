import { SectionWrapper } from "./section-wrapper";

interface CtaProps {
	children?: React.ReactNode;
}

export function Cta({ children }: CtaProps) {
	return (
		<SectionWrapper dark>
			<div className="text-center">
				<h2 className="mb-4 text-3xl font-bold md:text-4xl">Bereit für die KI-Ära?</h2>
				<p className="mx-auto mb-8 max-w-2xl text-lg text-text-inverse/80">
					Scanne deine Website jetzt und finde heraus, wie sichtbar du für KI-Agenten bist.
					Kostenlos und ohne Anmeldung.
				</p>

				{children}
			</div>
		</SectionWrapper>
	);
}
