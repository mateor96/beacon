"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ProjectTabs({ projectId }: { projectId: string }) {
	const pathname = usePathname();
	const base = `/monitoring/${projectId}`;
	const tabs = [
		{ href: base, label: "Übersicht" },
		{ href: `${base}/competitors`, label: "Wettbewerber" },
		{ href: `${base}/reddit`, label: "Reddit" },
		{ href: `${base}/alerts`, label: "Alerts" },
	];

	return (
		<nav aria-label="Projekt-Tabs" className="mb-6 flex gap-1 border-b border-border">
			{tabs.map((tab) => {
				const active = pathname === tab.href;
				return (
					<Link
						key={tab.href}
						href={tab.href}
						aria-current={active ? "page" : undefined}
						className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
							active
								? "border-primary text-primary"
								: "border-transparent text-text-muted hover:text-text"
						}`}
					>
						{tab.label}
					</Link>
				);
			})}
		</nav>
	);
}
