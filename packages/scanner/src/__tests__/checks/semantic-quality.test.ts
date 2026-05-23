import type { CheckContext } from "@beacon/shared";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

const { default: semanticQualityCheck } = await import("../../checks/semantic-quality.js");

// ── Helpers ─────────────────────────────────────────────────

function makeContext(html: string): CheckContext {
	return {
		inputUrl: "https://example.com",
		finalUrl: "https://example.com",
		html,
		parsedHtml: parse(html),
		responseTime: 100,
		statusCode: 200,
		redirects: [],
		subResources: {},
	};
}

// ── Fixtures ────────────────────────────────────────────────

const RICH_ARTICLE = `<html>
<head><title>Umfassender Artikel</title></head>
<body>
<header><nav><a href="/">Home</a></nav></header>
<main>
<article>
<h1>Umfassender Leitfaden zur KI-Optimierung von Webinhalten im Jahr 2024</h1>
<p>Die Optimierung von Webinhalten für KI-Systeme gewinnt zunehmend an Bedeutung. Unternehmen müssen ihre Online-Praesenz anpassen, um von modernen Suchmaschinen und Sprachassistenten besser verstanden zu werden. Dieser Leitfaden erklärt die wichtigsten Strategien und Maßnahmen für eine erfolgreiche KI-Optimierung.</p>
<h2>Warum ist KI-Optimierung wichtig für Unternehmen?</h2>
<p>Kuenstliche Intelligenz verändert die Art und Weise, wie Menschen Informationen im Internet suchen und konsumieren. Laut einer Studie von McKinsey nutzen bereits 65% der Verbraucher KI-basierte Assistenten für ihre täglichen Recherchen. Die semantische Qualität des Inhalts bestimmt dabei massgeblich, ob eine Webseite von diesen Systemen als zuverlässige Informationsquelle erkannt wird.</p>
<p>Besonders im deutschsprachigen Raum zeigt sich ein deutlicher Trend: Websites mit strukturiertem, inhaltlich reichhaltigem Content werden von KI-Systemen bevorzugt zitiert und empfohlen. Die Investition in qualitativ hochwertige Inhalte zahlt sich langfristig aus und staerkt die digitale Sichtbarkeit eines Unternehmens nachhaltig.</p>
<h2>Die 5 wichtigsten Faktoren für semantische Qualität</h2>
<p>Verschiedene Faktoren beeinflussen die semantische Qualität eines Textes. Diese Dimensionen werden sowohl von klassischen Suchmaschinen als auch von modernen KI-Systemen bewertet. Eine ganzheitliche Optimierung umfasst Textdichte, Vokabular, Lesbarkeit und thematische Kohaerenz.</p>
<ul><li>Textvoluem und Informationsdichte</li><li>Absatzstruktur und Gliederung</li><li>Wortschatzvielfalt und Fachterminologie</li></ul>
<h3>Wie kann man die semantische Qualität messen?</h3>
<p>Es gibt verschiedene Werkzeuge und Methoden zur Messung der semantischen Qualität. Automatisierte Scanner können Metriken wie Type-Token-Ratio, durchschnittliche Satzlänge und Content-to-Boilerplate-Verhaeltnis ermitteln. Diese quantitativen Kennzahlen bieten einen ersten Überblick über die Textqualität und helfen bei der gezielten Verbesserung.</p>
<p>Ergänzend dazu liefert eine KI-basierte Analyse qualitative Einschätzungen zu Klarheit, Einzigartigkeit und thematischem Fokus. Die Kombination beider Ansätze ermöglicht eine umfassende Bewertung der Inhaltsqualität, die weit über einfache Wortanzahl-Metriken hinausgeht und den tatsächlichen Informationswert eines Textes erfasst.</p>
</article>
</main>
<footer><p>Copyright 2024 - Impressum - Datenschutz</p></footer>
</body>
</html>`;

const DOCUMENTATION_PAGE = `<html>
<head><title>API-Dokumentation</title></head>
<body>
<main>
<article>
<h1>REST-API Dokumentation für die Entwickler-Schnittstelle Version 3.2</h1>
<p>Diese Dokumentation beschreibt alle verfügbaren Endpunkte, Authentifizierungsmethoden und Fehlerbehandlungsstrategien der Plattform-API. Die API basiert auf RESTful-Prinzipien und verwendet JSON als Datenformat für Request- und Response-Bodies.</p>
<h2>Authentifizierung und Autorisierung über OAuth 2.0</h2>
<p>Die API verwendet OAuth 2.0 mit Bearer-Token-Authentifizierung. Jeder API-Aufruf muss einen gueltigen Access-Token im Authorization-Header enthalten. Token haben eine Lebensdauer von 3600 Sekunden und müssen danach über den Refresh-Endpunkt erneuert werden.</p>
<p>Für Server-zu-Server-Kommunikation unterstützt die API auch Client-Credentials-Flow mit separaten Zugangsdaten und erhoehten Ratelimits von 1000 Anfragen pro Minute statt der üblichen 100.</p>
<h2>Endpunkt-Referenz und Parameterdetails</h2>
<p>Die folgenden Tabellen zeigen alle verfügbaren Endpunkte mit ihren HTTP-Methoden, erforderlichen Parametern und möglichen Statuscodes. Beachten Sie die Versionierung im URL-Pfad und die Paginierungsoptionen für Listenabfragen.</p>
<ul><li>GET /api/v3/users — Benutzerliste abrufen</li><li>POST /api/v3/scans — Neuen Scan starten</li><li>DELETE /api/v3/reports/{id} — Report löschen</li></ul>
<p>Alle Endpunkte geben strukturierte JSON-Antworten mit einheitlichem Fehlerformat zurück. HTTP-Statuscodes folgen den RFC-Standards mit zusätzlichen anwendungsspezifischen Fehlercodes im Response-Body.</p>
</article>
</main>
</body>
</html>`;

const THIN_CONTENT = `<html>
<head><title>Willkommen</title></head>
<body>
<nav><a href="/">Home</a><a href="/about">Über</a><a href="/contact">Kontakt</a></nav>
<div>
<h1>Willkommen</h1>
<p>Hier finden Sie Infos.</p>
</div>
<footer><p>Copyright 2024 - Impressum - Datenschutz - AGB - Kontakt</p></footer>
</body>
</html>`;

const REPETITIVE_TEXT = `<html>
<head><title>SEO-Spam</title></head>
<body>
<main>
<h1>Schuhe kaufen online guenstig Schuhe kaufen</h1>
<p>Schuhe kaufen online guenstig Schuhe kaufen. Kaufen Sie Schuhe online guenstig. Online Schuhe kaufen guenstig. Guenstig Schuhe online kaufen. Schuhe online kaufen guenstig bestellen.</p>
<p>Schuhe kaufen online guenstig Schuhe kaufen. Kaufen Sie Schuhe online guenstig. Online Schuhe kaufen guenstig. Guenstig Schuhe online kaufen. Schuhe online kaufen guenstig bestellen.</p>
<p>Schuhe kaufen online guenstig Schuhe kaufen. Kaufen Sie Schuhe online guenstig. Online Schuhe kaufen guenstig. Guenstig Schuhe online kaufen. Schuhe online kaufen guenstig bestellen.</p>
</main>
</body>
</html>`;

const BOILERPLATE_HEAVY = `<html>
<head><title>Boilerplate</title></head>
<body>
<nav>
<a href="/">Home</a><a href="/products">Produkte</a><a href="/services">Dienstleistungen</a>
<a href="/about">Über uns</a><a href="/team">Team</a><a href="/careers">Karriere</a>
<a href="/blog">Blog</a><a href="/contact">Kontakt</a><a href="/faq">FAQ</a>
<a href="/support">Support</a><a href="/partners">Partner</a><a href="/press">Presse</a>
</nav>
<header>
<p>Willkommen bei unserem Unternehmen. Seit über zwanzig Jahren sind wir fuehrend in der Branche und bieten erstklassige Loesungen für unsere Kunden weltweit an.</p>
</header>
<div>
<p>Kurzer Hauptinhalt.</p>
</div>
<footer>
<p>Copyright 2024 Alle Rechte vorbehalten. Impressum Datenschutz AGB Nutzungsbedingungen Cookie-Richtlinie Sitemap RSS Newsletter Abmelden Hilfe Center Community Forum Entwickler Blog Status Seite API Dokumentation Partner Programm Affiliate Jobs Karriere Presse Investor Relations.</p>
</footer>
</body>
</html>`;

const EMPTY_BODY = "<html><body></body></html>";

const SPA_SHELL = `<html>
<head><title>SPA</title></head>
<body>
<div id="app"></div>
<script src="/bundle.js"></script>
</body>
</html>`;

const FAQ_PAGE = `<html>
<head><title>FAQ</title></head>
<body>
<main>
<article>
<h1>Häufig gestellte Fragen zu unserem Produkt und unseren Dienstleistungen</h1>
<p>Hier finden Sie Antworten auf die am häufigsten gestellten Fragen unserer Kunden. Unsere FAQ-Seite wird regelmäßig aktualisiert, um Ihnen stets die relevantesten Informationen bereitzustellen.</p>
<h2>Wie funktioniert die Registrierung und Kontoerestllung?</h2>
<p>Die Registrierung erfolgt über unser Online-Formular in wenigen Schritten. Sie benoetigen lediglich eine gueltige E-Mail-Adresse und ein sicheres Passwort mit mindestens 12 Zeichen. Nach der Registrierung erhalten Sie eine Bestätigungsmail innerhalb von 5 Minuten.</p>
<h2>Welche Zahlungsmethoden werden akzeptiert?</h2>
<p>Wir akzeptieren Kreditkarten (Visa, Mastercard, American Express), SEPA-Lastschrift und PayPal. Für Unternehmen bieten wir zusätzlich Rechnungskauf mit 30 Tagen Zahlungsziel ab einem Bestellwert von 500 Euro an.</p>
<h2>Wie kann ich mein Abonnement kündigen?</h2>
<p>Die Kündigung ist jederzeit zum Ende der aktuellen Abrechnungsperiode möglich. Navigieren Sie dazu in Ihrem Dashboard zum Bereich Einstellungen und waehlen Sie Abonnement verwalten. Die Kündigungsbestätigung erhalten Sie per E-Mail innerhalb von 24 Stunden.</p>
</article>
</main>
</body>
</html>`;

const SINGLE_PARAGRAPH = `<html>
<body>
<main>
<h1>Einzelner Absatz</h1>
<p>Dies ist ein einzelner langer Absatz der viele verschiedene Themen behandelt und dabei eine Vielzahl von Fachbegriffen wie Algorithmus, Datenstruktur, Compiler und Betriebssystem verwendet, um die Informationsdichte des Textes zu demonstrieren und gleichzeitig die Wichtigkeit einer guten Textstruktur zu unterstreichen, die für KI-Systeme besonders relevant ist und die Verarbeitung natürlicher Sprache erheblich beeinflusst.</p>
</main>
</body>
</html>`;

// ── Tests ───────────────────────────────────────────────────

describe("semantic-quality check", () => {
	describe("metadata", () => {
		it("has correct id, category, and severity", () => {
			expect(semanticQualityCheck.id).toBe("semantic-quality");
			expect(semanticQualityCheck.category).toBe("readability");
			expect(semanticQualityCheck.severity).toBe("important");
		});
	});

	describe("pass scenarios", () => {
		it("rich article returns pass with score >= 80", async () => {
			const result = await semanticQualityCheck.run(makeContext(RICH_ARTICLE));

			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(80);
			expect(result.issues.some((i) => i.severity === "critical")).toBe(false);
		});

		it("documentation page returns pass with score >= 80", async () => {
			const result = await semanticQualityCheck.run(makeContext(DOCUMENTATION_PAGE));

			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(80);
		});

		it("FAQ page with questions returns pass", async () => {
			const result = await semanticQualityCheck.run(makeContext(FAQ_PAGE));

			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(80);
		});
	});

	describe("warn scenarios", () => {
		it("repetitive text returns warn with vocabulary issue", async () => {
			const result = await semanticQualityCheck.run(makeContext(REPETITIVE_TEXT));

			expect(result.score).toBeGreaterThanOrEqual(20);
			expect(result.score).toBeLessThan(80);
		});

		it("boilerplate-heavy page returns warn or fail", async () => {
			const result = await semanticQualityCheck.run(makeContext(BOILERPLATE_HEAVY));

			expect(result.score).toBeLessThan(80);
		});
	});

	describe("fail scenarios", () => {
		it("empty body returns fail with score <= 5", async () => {
			const result = await semanticQualityCheck.run(makeContext(EMPTY_BODY));

			expect(result.status).toBe("fail");
			expect(result.score).toBeLessThanOrEqual(5);
		});

		it("SPA shell returns fail", async () => {
			const result = await semanticQualityCheck.run(makeContext(SPA_SHELL));

			expect(result.status).toBe("fail");
			expect(result.score).toBeLessThan(40);
		});

		it("thin content returns fail with critical content-volume issue", async () => {
			const result = await semanticQualityCheck.run(makeContext(THIN_CONTENT));

			expect(result.status).toBe("fail");
			expect(
				result.issues.some((i) => i.severity === "critical" && i.message.includes("Textinhalt")),
			).toBe(true);
		});
	});

	describe("edge cases", () => {
		it("single paragraph scores lower than multi-paragraph article", async () => {
			const singleResult = await semanticQualityCheck.run(makeContext(SINGLE_PARAGRAPH));
			const richResult = await semanticQualityCheck.run(makeContext(RICH_ARTICLE));

			expect(singleResult.score).toBeLessThan(richResult.score);
		});

		it("FAQ page questions boost readability score", async () => {
			const result = await semanticQualityCheck.run(makeContext(FAQ_PAGE));
			const details = result.details as Record<string, unknown>;

			expect(details.questionCount).toBeGreaterThanOrEqual(3);
		});

		it("nav/header/footer text excluded from main content analysis", async () => {
			const result = await semanticQualityCheck.run(makeContext(BOILERPLATE_HEAVY));
			const details = result.details as Record<string, unknown>;

			expect(details.boilerplateRatio).toBeLessThan(0.5);
		});
	});

	describe("crash resistance", () => {
		it("does not crash when parsedHtml is null", async () => {
			const ctx: CheckContext = {
				inputUrl: "https://example.com",
				finalUrl: "https://example.com",
				html: "",
				parsedHtml: null,
				responseTime: 100,
				statusCode: 200,
				redirects: [],
				subResources: {},
			};
			const result = await semanticQualityCheck.run(ctx);
			expect(result.status).toBe("fail");
			expect(result.score).toBeLessThanOrEqual(5);
		});

		it("does not crash when parsedHtml is undefined", async () => {
			const ctx: CheckContext = {
				inputUrl: "https://example.com",
				finalUrl: "https://example.com",
				html: "",
				parsedHtml: undefined,
				responseTime: 100,
				statusCode: 200,
				redirects: [],
				subResources: {},
			};
			const result = await semanticQualityCheck.run(ctx);
			expect(result.status).toBe("fail");
			expect(result.score).toBeLessThanOrEqual(5);
		});

		it("handles HTML with only comments", async () => {
			const ctx = makeContext("<!-- just a comment -->");
			const result = await semanticQualityCheck.run(ctx);
			expect(result.status).toBeDefined();
			expect(result.score).toBeGreaterThanOrEqual(0);
		});
	});

	describe("score boundaries", () => {
		it("score never exceeds 100", async () => {
			const result = await semanticQualityCheck.run(makeContext(RICH_ARTICLE));

			expect(result.score).toBeLessThanOrEqual(100);
		});

		it("rich article score is between 80-100", async () => {
			const result = await semanticQualityCheck.run(makeContext(RICH_ARTICLE));

			expect(result.score).toBeGreaterThanOrEqual(80);
			expect(result.score).toBeLessThanOrEqual(100);
		});

		it("thin content score is below 40", async () => {
			const result = await semanticQualityCheck.run(makeContext(THIN_CONTENT));

			expect(result.score).toBeLessThan(40);
		});
	});

	describe("details object", () => {
		it("contains expected fields for rich article", async () => {
			const result = await semanticQualityCheck.run(makeContext(RICH_ARTICLE));
			const details = result.details as Record<string, unknown>;

			expect(details.wordCount).toBeGreaterThan(200);
			expect(details.sentenceCount).toBeGreaterThan(5);
			expect(details.paragraphCount).toBeGreaterThanOrEqual(5);
			expect(details.typeTokenRatio).toBeGreaterThan(0);
			expect(details.avgSentenceLength).toBeGreaterThan(0);
			expect(details.boilerplateRatio).toBeGreaterThan(0);
		});

		it("contains expected fields for empty page", async () => {
			const result = await semanticQualityCheck.run(makeContext(EMPTY_BODY));
			const details = result.details as Record<string, unknown>;

			expect(details.wordCount).toBe(0);
			expect(details.sentenceCount).toBe(0);
			expect(details.paragraphCount).toBe(0);
		});
	});

	describe("issue severities", () => {
		it("too little text produces critical issue", async () => {
			const result = await semanticQualityCheck.run(makeContext(THIN_CONTENT));

			expect(
				result.issues.some((i) => i.severity === "critical" && i.message.includes("Textinhalt")),
			).toBe(true);
		});

		it("no paragraphs produces important issue", async () => {
			const result = await semanticQualityCheck.run(makeContext(SPA_SHELL));

			expect(
				result.issues.some((i) => i.severity === "important" && i.message.includes("Absätze")),
			).toBe(true);
		});

		it("short paragraphs produce nice-to-have issue", async () => {
			const shortParasHtml = `<html><body><main>
				<h1>Kurze Absätze</h1>
				<p>Kurz eins.</p>
				<p>Kurz zwei hier.</p>
				<p>Kurz drei da.</p>
				<p>Kurz vier dort.</p>
				<p>Kurz fuenf jetzt.</p>
			</main></body></html>`;
			const result = await semanticQualityCheck.run(makeContext(shortParasHtml));

			expect(
				result.issues.some((i) => i.severity === "nice-to-have" && i.message.includes("kurz")),
			).toBe(true);
		});
	});
});
