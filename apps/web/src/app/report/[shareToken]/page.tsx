import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
	params: Promise<{ shareToken: string }>;
}

export const metadata = {
	robots: { index: false, follow: false },
	other: { "referrer-policy": "no-referrer" },
};

export default async function SharedReportPage({ params }: Props) {
	const { shareToken } = await params;

	const { db, reportShareQueries, scanQueries, profileQueries } = await import("@beacon/db");
	const share = await reportShareQueries.getActiveByToken(db, shareToken);
	if (!share) {
		notFound();
	}

	// Password gate
	if (share.passwordHash) {
		const cookieStore = await cookies();
		const cookieName = `beacon_share_${shareToken.slice(0, 12)}`;
		if (cookieStore.get(cookieName)?.value !== "1") {
			redirect(`/report/${shareToken}/password`);
		}
	}

	const scan = await scanQueries.getById(db, share.reportId);
	if (!scan || scan.status !== "completed") {
		notFound();
	}

	const branding = await profileQueries.getBranding(db, share.userId);

	// Record access (fire-and-forget)
	void reportShareQueries.recordAccess(db, share.id).catch(() => {});

	const primaryColor = branding?.primaryColor || "#2563eb";
	const agencyName = branding?.agencyName || "Report";
	const logoUrl = branding?.logoUrl;

	return (
		<html lang="de">
			<head>
				<title>{`${agencyName} · Report`}</title>
				<meta name="referrer" content="no-referrer" />
				<meta name="robots" content="noindex, nofollow" />
				<style>
					{
						"body { margin: 0; font-family: system-ui, sans-serif; color: #1f2937; background: #f8fafc; }"
					}
				</style>
			</head>
			<body>
				<header
					style={{
						background: primaryColor,
						color: "white",
						padding: "16px 24px",
						display: "flex",
						alignItems: "center",
						gap: "12px",
					}}
				>
					{logoUrl ? (
						<img src={logoUrl} alt={agencyName} style={{ height: 32 }} />
					) : (
						<strong style={{ fontSize: 18 }}>{agencyName}</strong>
					)}
				</header>
				<main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
					<h1 style={{ fontSize: 24, marginBottom: 8 }}>AI-Readiness Report</h1>
					<p style={{ color: "#64748b", marginBottom: 24 }}>
						URL: <span style={{ fontFamily: "monospace" }}>{scan.url}</span>
					</p>
					<div
						style={{
							background: "white",
							borderRadius: 8,
							padding: 24,
							marginBottom: 16,
							display: "flex",
							gap: 24,
							alignItems: "center",
						}}
					>
						<div
							style={{
								width: 120,
								textAlign: "center",
								borderRight: "1px solid #e2e8f0",
								paddingRight: 24,
							}}
						>
							<div style={{ fontSize: 48, fontWeight: 800, color: primaryColor }}>{scan.score}</div>
							<div style={{ fontSize: 12, color: "#94a3b8" }}>/ 100</div>
						</div>
						<div>
							<div style={{ fontSize: 14, color: "#64748b" }}>AI-Readiness Level</div>
							<div style={{ fontSize: 20, fontWeight: 600 }}>Stufe {scan.readinessLevel}</div>
							<div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
								Erstellt am: {new Date(scan.scannedAt).toLocaleDateString("de-DE")}
							</div>
						</div>
					</div>
					{branding?.footerText && (
						<footer
							style={{
								marginTop: 48,
								paddingTop: 24,
								borderTop: "1px solid #e2e8f0",
								color: "#64748b",
								fontSize: 12,
								textAlign: "center",
							}}
						>
							{branding.footerText}
						</footer>
					)}
				</main>
			</body>
		</html>
	);
}
