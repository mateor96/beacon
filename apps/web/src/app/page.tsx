import {
	Cta,
	Faq,
	Features,
	Footer,
	Hero,
	JsonLd,
	Navbar,
	Problem,
	ScanForm,
	Solution,
} from "@/components/landing";

export default function HomePage() {
	return (
		<>
			<JsonLd />
			<Navbar />
			<Hero>
				<ScanForm variant="hero" />
			</Hero>
			<Problem />
			<Solution />
			<Features />
			<Faq />
			<Cta>
				<ScanForm variant="compact" />
			</Cta>
			<Footer />
		</>
	);
}
