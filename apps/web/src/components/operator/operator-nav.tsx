"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, type NavItem } from "./nav-config";

function isActive(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}

function linkClasses(active: boolean): string {
	return [
		"block rounded-md px-3 py-2 text-sm font-medium transition-colors",
		active ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-surface hover:text-text",
	].join(" ");
}

/**
 * Operator navigation. Renders a persistent left sidebar on `md+` and a
 * horizontally-scrollable top bar on small screens — both driven by
 * {@link NAV_GROUPS}. Active state derived from the current pathname.
 */
export function OperatorNav() {
	const pathname = usePathname();
	const allItems: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

	return (
		<>
			{/* Mobile top bar */}
			<header className="border-b border-border bg-surface md:hidden">
				<div className="flex items-center justify-between px-4 py-3">
					<Link href="/dashboard" className="text-lg font-bold text-primary">
						Beacon
					</Link>
				</div>
				<nav aria-label="Operator-Navigation" className="flex gap-1 overflow-x-auto px-2 pb-2">
					{allItems.map((item) => {
						const active = isActive(pathname, item.href);
						return (
							<Link
								key={item.href}
								href={item.href}
								aria-current={active ? "page" : undefined}
								className={`${linkClasses(active)} whitespace-nowrap`}
							>
								{item.label}
							</Link>
						);
					})}
				</nav>
			</header>

			{/* Desktop sidebar */}
			<aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
				<div className="border-b border-border px-5 py-5">
					<Link href="/dashboard" className="text-xl font-bold text-primary">
						Beacon
					</Link>
					<p className="mt-1 text-xs text-text-muted">Operator-Konsole</p>
				</div>
				<nav
					aria-label="Operator-Navigation"
					className="flex-1 space-y-6 overflow-y-auto px-3 py-5"
				>
					{NAV_GROUPS.map((group) => (
						<div key={group.label}>
							<p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
								{group.label}
							</p>
							<ul className="space-y-1">
								{group.items.map((item) => {
									const active = isActive(pathname, item.href);
									return (
										<li key={item.href}>
											<Link
												href={item.href}
												aria-current={active ? "page" : undefined}
												className={linkClasses(active)}
											>
												{item.label}
											</Link>
										</li>
									);
								})}
							</ul>
						</div>
					))}
				</nav>
			</aside>
		</>
	);
}
