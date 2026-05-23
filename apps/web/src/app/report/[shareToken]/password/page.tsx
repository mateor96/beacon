import { SharePasswordForm } from "@/components/shares/share-password-form";

interface Props {
	params: Promise<{ shareToken: string }>;
}

export const metadata = {
	robots: { index: false, follow: false },
};

export default async function SharePasswordPage({ params }: Props) {
	const { shareToken } = await params;
	return (
		<html lang="de">
			<head>
				<title>Passwort erforderlich</title>
				<meta name="referrer" content="no-referrer" />
				<meta name="robots" content="noindex, nofollow" />
			</head>
			<body style={{ fontFamily: "system-ui, sans-serif", background: "#f8fafc", margin: 0 }}>
				<main
					style={{
						maxWidth: 400,
						margin: "80px auto",
						padding: 32,
						background: "white",
						borderRadius: 8,
					}}
				>
					<h1 style={{ fontSize: 20, marginBottom: 16 }}>Passwort erforderlich</h1>
					<p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>
						Dieser Report ist passwortgeschuetzt. Bitte geben Sie das Passwort ein, das Sie von der
						Agentur erhalten haben.
					</p>
					<SharePasswordForm shareToken={shareToken} />
				</main>
			</body>
		</html>
	);
}
