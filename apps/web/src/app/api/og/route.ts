import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import type { ReactElement } from "react";

export const runtime = "edge";

/**
 * Dynamic Open Graph image (#217).
 *
 * Renders a 1200x630 PNG with the audit score + domain overlaid on the
 * Beacon brand background. Used by the metadata export in
 * /audit/[jobId]/page.tsx to deliver rich link previews in social
 * media and messaging apps.
 */
export async function GET(req: NextRequest) {
	const url = new URL(req.url);
	const score = Number.parseInt(url.searchParams.get("score") ?? "0", 10) || 0;
	const domain = url.searchParams.get("domain") ?? "";

	const scoreColor =
		score >= 80 ? "#16a34a" : score >= 60 ? "#2563eb" : score >= 40 ? "#f59e0b" : "#dc2626";

	return new ImageResponse(
		{
			type: "div",
			key: null,
			props: {
				style: {
					height: "100%",
					width: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "#0f172a",
					color: "#f8fafc",
					fontFamily: "system-ui",
					padding: "60px",
				},
				children: [
					{
						type: "div",
						key: "label",
						props: {
							style: { fontSize: 28, opacity: 0.7, marginBottom: 16 },
							children: "Beacon — AI Readiness Check",
						},
					},
					{
						type: "div",
						key: "score",
						props: {
							style: {
								fontSize: 180,
								fontWeight: 800,
								lineHeight: 1,
								color: scoreColor,
							},
							children: `${score}`,
						},
					},
					{
						type: "div",
						key: "caption",
						props: {
							style: { fontSize: 32, opacity: 0.6, marginTop: 4, marginBottom: 32 },
							children: "AI-Readiness Score / 100",
						},
					},
					{
						type: "div",
						key: "domain",
						props: {
							style: {
								fontSize: 36,
								fontWeight: 600,
								textAlign: "center",
								maxWidth: 900,
								overflow: "hidden",
								whiteSpace: "nowrap",
								textOverflow: "ellipsis",
							},
							children: domain || "—",
						},
					},
				] as ReactElement[],
			},
		} as unknown as ReactElement,
		{ width: 1200, height: 630 },
	);
}
