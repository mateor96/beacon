import { SectionWrapper } from "./section-wrapper";

const stats = [
	{ value: "500+", label: "Websites analysiert" },
	{ value: "10", label: "KI-Readiness-Checks" },
	{ value: "<30s", label: "Analyse-Dauer" },
	{ value: "100%", label: "Kostenlos" },
];

export function SocialProof() {
	return (
		<SectionWrapper id="social-proof" className="bg-surface-alt">
			<div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
				{stats.map((stat) => (
					<div key={stat.label}>
						<div className="text-3xl font-bold text-primary">{stat.value}</div>
						<div className="text-sm text-text-muted">{stat.label}</div>
					</div>
				))}
			</div>
		</SectionWrapper>
	);
}
