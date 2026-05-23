interface SectionWrapperProps {
	id?: string;
	children: React.ReactNode;
	className?: string;
	dark?: boolean;
}

export function SectionWrapper({
	id,
	children,
	className = "",
	dark = false,
}: SectionWrapperProps) {
	return (
		<section
			id={id}
			className={`px-4 py-16 sm:px-6 md:py-24 lg:px-8 ${
				dark ? "bg-surface-dark text-text-inverse" : "bg-surface"
			} ${className}`}
		>
			<div className="mx-auto max-w-6xl">{children}</div>
		</section>
	);
}
