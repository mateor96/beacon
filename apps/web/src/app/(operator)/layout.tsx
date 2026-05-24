import { OperatorNav } from "@/components/operator/operator-nav";
import type { Metadata } from "next";

/**
 * Shared shell for all operator pages. The `(operator)` route group is
 * URL-transparent, so pages keep their existing paths. `noindex` is set once
 * here and inherited by every operator page. Pages render their own `<main>`,
 * so this layout intentionally does not.
 */
export const metadata: Metadata = {
	robots: { index: false, follow: false },
};

export default function OperatorLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="min-h-screen md:flex">
			<OperatorNav />
			<div className="min-w-0 flex-1">{children}</div>
		</div>
	);
}
