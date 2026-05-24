import type { ReactNode } from "react";

type Tone = "success" | "danger" | "muted" | "primary";

const TONE_CLASSES: Record<Tone, string> = {
	success: "bg-success/10 text-success",
	danger: "bg-danger/10 text-danger",
	muted: "bg-surface-alt text-text-muted",
	primary: "bg-primary-light text-primary",
};

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
		>
			{children}
		</span>
	);
}

export function SectionCard({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<section className="rounded-lg border border-border bg-surface p-5">
			<h2 className="text-lg font-semibold text-text">{title}</h2>
			{description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
			<div className="mt-4">{children}</div>
		</section>
	);
}

export function EmptyHint({ children }: { children: ReactNode }) {
	return (
		<div className="rounded-md border border-border bg-surface-alt p-4 text-sm text-text-muted">
			{children}
		</div>
	);
}
