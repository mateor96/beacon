import type { CheckContext } from "@beacon/shared";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

const { default: contentStructureCheck } = await import("../../checks/content-structure.js");

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

const PERFECT_BLOG = `<html>
<head><title>Perfekter Blog</title></head>
<body>
<header><nav><a href="/">Home</a></nav></header>
<main>
<article>
<h1>Umfassender Leitfaden zur Webentwicklung mit modernen Standards</h1>
<p>Dieser umfassende Leitfaden behandelt alle wichtigen Aspekte der modernen Webentwicklung und gibt praktische Tipps für Entwickler.</p>
<h2>Grundlagen der Frontend-Entwicklung und ihre Bedeutung</h2>
<p>Die Frontend-Entwicklung hat sich in den letzten Jahren stark verändert und bietet viele neue Möglichkeiten für interaktive Webanwendungen.</p>
<p>Neue Frameworks und Tools ermöglichen es Entwicklern, schneller und effizienter zu arbeiten als je zuvor in der Geschichte des Webs.</p>
<h3>HTML und CSS als Fundament moderner Webanwendungen</h3>
<p>HTML und CSS bilden die Grundlage jeder modernen Webanwendung und sind unverzichtbar für die Erstellung barrierefreier Webseiten.</p>
<ul><li>Semantisches HTML</li><li>CSS Grid</li><li>Flexbox Layout</li></ul>
<h3>JavaScript und TypeScript für interaktive Anwendungen</h3>
<p>JavaScript ist die Programmiersprache des Webs und bildet zusammen mit TypeScript ein leistungsstarkes Entwicklungs-Oekosystem.</p>
<ol><li>Variablen und Typen</li><li>Funktionen und Klassen</li></ol>
<section>
<h2>Fortgeschrittene Techniken und Best Practices</h2>
<p>Fortgeschrittene Techniken helfen dabei, die Performance und Wartbarkeit von Webanwendungen erheblich zu verbessern.</p>
</section>
</article>
</main>
<footer><p>Copyright 2024 - Alle Rechte vorbehalten</p></footer>
</body>
</html>`;

const DOCUMENTATION_PAGE = `<html>
<head><title>Dokumentation</title></head>
<body>
<nav><a href="/">Startseite</a><a href="/docs">Dokumentation</a></nav>
<main>
<article>
<h1>API-Dokumentation für die Entwickler-Schnittstelle</h1>
<p>Diese Dokumentation beschreibt alle verfügbaren Endpunkte und Parameter der REST-API für Entwickler und Integrationen.</p>
<h2>Authentifizierung und Sicherheitsrichtlinien</h2>
<p>Die API verwendet OAuth 2.0 zur Authentifizierung und erfordert einen gueltigen API-Schlüssel für jeden Request an die Schnittstelle.</p>
<h3>API-Schlüssel erstellen und verwalten</h3>
<p>API-Schlüssel können im Dashboard erstellt und verwaltet werden und müssen sicher aufbewahrt werden.</p>
<h4>Schlüssel-Typen und Berechtigungen</h4>
<p>Es gibt verschiedene Schlüssel-Typen mit unterschiedlichen Berechtigungsstufen für verschiedene Anwendungsfaelle.</p>
<ul><li>Read-Only Schlüssel</li><li>Read-Write Schlüssel</li></ul>
<h5>Berechtigungsmatrix und Zugriffssteuerung</h5>
<p>Die Berechtigungsmatrix zeigt, welche Aktionen mit welchem Schlüssel-Typ möglich sind und welche Einschraenkungen gelten.</p>
<h6>Detaillierte Zugriffsrechte und Konfiguration</h6>
<ol><li>GET-Endpunkte</li><li>POST-Endpunkte</li><li>DELETE-Endpunkte</li></ol>
</article>
</main>
</body>
</html>`;

const GOOD_LANDING = `<html>
<head><title>Landing Page</title></head>
<body>
<div class="hero">
<h1>Willkommen bei unserem fantastischen Produkt für Teams</h1>
<p>Unser Produkt hilft Teams dabei, effizienter zusammenzuarbeiten und ihre Projekte erfolgreich umzusetzen und zu verwalten.</p>
</div>
<div class="features">
<h2>Unsere wichtigsten Features im Überblick</h2>
<p>Entdecken Sie die vielfaeltigen Funktionen, die unser Produkt zu bieten hat und die Ihre Arbeit erleichtern werden.</p>
<h2>Preise und Abonnement-Optionen für Teams</h2>
<p>Waehlen Sie den passenden Plan für Ihr Team und starten Sie noch heute mit der Nutzung unseres Produkts.</p>
</div>
</body>
</html>`;

const NO_SEMANTIC_HTML = `<html>
<head><title>Keine Semantik</title></head>
<body>
<div class="wrapper">
<h1>Hauptüberschrift der Seite ohne semantische Elemente</h1>
<h2>Erste Unterkategorie mit relevantem Inhalt</h2>
<p>Dieser Text beschreibt die erste Kategorie ausführlich und bietet dem Leser wertvolle Informationen zum Thema.</p>
<p>Weitere Details zur ersten Kategorie folgen hier mit zusätzlichen Erklärungen und Beispielen für besseres Verständnis.</p>
<h2>Zweite Unterkategorie mit weiterem Inhalt</h2>
<p>Dieser Text beschreibt die zweite Kategorie ausführlich und bietet weitere Einblicke in das Themengebiet für Interessierte.</p>
<p>Noch mehr Informationen zur zweiten Kategorie mit praktischen Tipps und Anleitungen für die Umsetzung im Alltag.</p>
<p>Ein dritter Absatz in dieser Kategorie rundet die Informationen ab und bietet einen umfassenden Überblick über das Thema.</p>
</div>
</body>
</html>`;

const MULTIPLE_H1 = `<html>
<head><title>Mehrere H1</title></head>
<body>
<main>
<h1>Erste Hauptüberschrift der Seite</h1>
<p>Ein Absatz mit genug Text um als substantieller Inhalt zu gelten und die Mindestlänge zu erreichen für die Analyse.</p>
<h1>Zweite Hauptüberschrift der Seite</h1>
<p>Noch ein Absatz mit ausreichend Text für die Inhaltsanalyse und die Bewertung der Seitenstruktur im Scanner.</p>
<h2>Eine regulaere Unterüberschrift hier</h2>
<p>Dritter Absatz mit genug Inhalt für die Analyse der Content-Struktur und die Bewertung der semantischen Qualität.</p>
</main>
</body>
</html>`;

const HEADING_SKIP = `<html>
<head><title>Heading Skip</title></head>
<body>
<main>
<article>
<h1>Die Hauptüberschrift dieser Beispielseite</h1>
<p>Ein substantieller Absatz mit mindestens fuenfzig Zeichen Länge für die korrekte Analyse der Seitenstruktur.</p>
<h3>Eine H3 direkt nach H1 — H2 fehlt hier</h3>
<p>Noch ein Absatz mit ausreichend Text für die Bewertung der Content-Struktur und Heading-Hierarchie der Seite.</p>
<h2>Danach kommt eine regulaere H2-Ueberschrift</h2>
<p>Ein weiterer Absatz der die Content-Tiefe erhöht und die Analyse der Seitenstruktur unterstützt für den Scanner.</p>
</article>
</main>
</body>
</html>`;

const NO_H1 = `<html>
<head><title>Keine H1</title></head>
<body>
<main>
<h2>Eine H2-Ueberschrift als Ersatz für die fehlende H1</h2>
<p>Dieser Absatz hat genug Text um als substantieller Inhalt zu gelten und die Bewertung der Seitenstruktur zu ermöglichen.</p>
<h3>Eine H3-Unterüberschrift mit relevantem Titel</h3>
<p>Noch ein Absatz mit ausreichend Inhalt für die Analyse der Content-Struktur und die Bewertung durch den Scanner.</p>
<p>Ein dritter Absatz der die Content-Tiefe erhöht und mehr Informationen zum Thema bietet für die Leser der Seite.</p>
</main>
</body>
</html>`;

const REVERSE_HEADINGS = `<html>
<head><title>Umgekehrt</title></head>
<body>
<div>
<h6>Klein</h6>
<h5>Etwas</h5>
<h4>Groesser</h4>
</div>
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

const IMAGES_ONLY = `<html>
<head><title>Bilder</title></head>
<body>
<img src="/img1.png" alt="Bild 1">
<img src="/img2.png" alt="Bild 2">
<img src="/img3.png" alt="Bild 3">
</body>
</html>`;

const SINGLE_PARAGRAPH = `<html>
<head><title>Einzeln</title></head>
<body>
<h1>Eine einzelne Ueberschrift</h1>
<p>Kurz.</p>
</body>
</html>`;

const IFRAME_HEAVY = `<html>
<head><title>Iframes</title></head>
<body>
<h1>Iframe-Seite mit eingebetteten Inhalten</h1>
<iframe src="/embed1"></iframe>
<iframe src="/embed2"></iframe>
<iframe src="/embed3"></iframe>
<p>Minimal.</p>
</body>
</html>`;

const VERY_LONG_CONTENT = `<html>
<head><title>Langer Inhalt</title></head>
<body>
<main>
<article>
<h1>Umfassender Artikel mit sehr viel Textinhalt und Struktur</h1>
${Array.from({ length: 20 }, (_, i) => `<p>Dies ist Absatz Nummer ${i + 1} mit genug Text um als substantieller Inhalt für die Analyse zu gelten und die Bewertung zu beeinflussen.</p>`).join("\n")}
<h2>Zweite Ueberschrift für bessere Strukturierung</h2>
<ul><li>Punkt eins</li><li>Punkt zwei</li></ul>
<ol><li>Schritt eins</li><li>Schritt zwei</li></ol>
</article>
</main>
</body>
</html>`;

const NESTED_ARTICLES = `<html>
<head><title>Verschachtelt</title></head>
<body>
<main>
<article>
<h1>Hauptartikel mit verschachtelten Unterartikeln</h1>
<p>Der Hauptartikel enthaelt mehrere verschachtelte Artikel mit eigenem Inhalt und eigener Struktur für die Analyse.</p>
<article>
<h2>Erster verschachtelter Unterartikel hier</h2>
<p>Inhalt des ersten verschachtelten Artikels mit genug Text für die korrekte Analyse der Content-Struktur.</p>
</article>
<article>
<h2>Zweiter verschachtelter Unterartikel hier</h2>
<p>Inhalt des zweiten verschachtelten Artikels mit ausreichend Text für die Bewertung durch den Scanner.</p>
</article>
<h2>Zusammenfassung und Fazit des Hauptartikels</h2>
<p>Abschliessende Zusammenfassung des Hauptartikels mit praktischen Tipps und Empfehlungen für die Leser der Seite.</p>
</article>
</main>
</body>
</html>`;

// ── Tests ───────────────────────────────────────────────────

describe("content-structure check", () => {
	describe("metadata", () => {
		it("has correct id, category, and severity", () => {
			expect(contentStructureCheck.id).toBe("content-structure");
			expect(contentStructureCheck.category).toBe("readability");
			expect(contentStructureCheck.severity).toBe("important");
		});
	});

	describe("pass scenarios", () => {
		it("perfect blog post returns pass with score >= 90", async () => {
			const result = await contentStructureCheck.run(makeContext(PERFECT_BLOG));

			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(90);
			expect(result.issues.some((i) => i.severity === "critical")).toBe(false);
		});

		it("documentation page returns pass with score >= 85", async () => {
			const result = await contentStructureCheck.run(makeContext(DOCUMENTATION_PAGE));

			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(85);
		});

		it("deep heading nesting H1-H6 returns pass with score >= 85", async () => {
			const result = await contentStructureCheck.run(makeContext(DOCUMENTATION_PAGE));

			const details = result.details as Record<string, unknown>;
			const levels = details.headingLevels as number[];
			expect(levels).toContain(1);
			expect(levels).toContain(6);
			expect(result.score).toBeGreaterThanOrEqual(85);
		});
	});

	describe("warn scenarios", () => {
		it("landing page with divs returns warn with semantic HTML issue", async () => {
			const result = await contentStructureCheck.run(makeContext(GOOD_LANDING));

			expect(result.status).toBe("warn");
			expect(
				result.issues.some((i) => i.message.includes("main") || i.message.includes("semantisch")),
			).toBe(true);
		});

		it("multiple H1 tags returns warn with issue about multiple H1", async () => {
			const result = await contentStructureCheck.run(makeContext(MULTIPLE_H1));

			expect(result.status).toBe("warn");
			expect(result.issues.some((i) => i.message.includes("Haupttitel (H1)"))).toBe(true);
		});

		it("heading level skip H1→H3 returns warn with hierarchy issue", async () => {
			const result = await contentStructureCheck.run(makeContext(HEADING_SKIP));

			expect(result.status).toBe("warn");
			expect(result.issues.some((i) => i.message.includes("Ebenenwechsel"))).toBe(true);
		});

		it("good content without semantic HTML returns warn", async () => {
			const result = await contentStructureCheck.run(makeContext(NO_SEMANTIC_HTML));

			expect(result.status).toBe("warn");
			expect(result.issues.some((i) => i.message.includes("<main>"))).toBe(true);
		});
	});

	describe("fail scenarios", () => {
		it("empty body returns fail with score 0-5", async () => {
			const result = await contentStructureCheck.run(makeContext(EMPTY_BODY));

			expect(result.status).toBe("fail");
			expect(result.score).toBeLessThanOrEqual(10);
		});

		it("missing H1 returns fail with critical issue", async () => {
			const result = await contentStructureCheck.run(makeContext(NO_H1));

			expect(result.issues.some((i) => i.severity === "critical" && i.message.includes("H1"))).toBe(
				true,
			);
		});

		it("reverse heading order returns fail", async () => {
			const result = await contentStructureCheck.run(makeContext(REVERSE_HEADINGS));

			expect(result.status).toBe("fail");
		});

		it("SPA shell returns fail", async () => {
			const result = await contentStructureCheck.run(makeContext(SPA_SHELL));

			expect(result.status).toBe("fail");
			expect(result.score).toBeLessThan(15);
		});

		it("images only returns fail", async () => {
			const result = await contentStructureCheck.run(makeContext(IMAGES_ONLY));

			expect(result.status).toBe("fail");
			expect(result.score).toBeLessThan(15);
		});
	});

	describe("edge cases", () => {
		it("single short paragraph scores 30-45", async () => {
			const result = await contentStructureCheck.run(makeContext(SINGLE_PARAGRAPH));

			expect(result.score).toBeGreaterThanOrEqual(20);
			expect(result.score).toBeLessThanOrEqual(45);
		});

		it("iframe-heavy page scores low", async () => {
			const result = await contentStructureCheck.run(makeContext(IFRAME_HEAVY));

			expect(result.score).toBeLessThan(50);
		});

		it("no headings at all produces critical issue", async () => {
			const result = await contentStructureCheck.run(makeContext(EMPTY_BODY));

			expect(result.issues.some((i) => i.severity === "critical")).toBe(true);
		});

		it("very long content (20 paragraphs) returns pass", async () => {
			const result = await contentStructureCheck.run(makeContext(VERY_LONG_CONTENT));

			expect(result.status).toBe("pass");
		});

		it("nested articles cause no false negatives", async () => {
			const result = await contentStructureCheck.run(makeContext(NESTED_ARTICLES));

			expect(result.score).toBeGreaterThanOrEqual(70);
			expect(result.issues.some((i) => i.severity === "critical")).toBe(false);
		});
	});

	describe("score boundaries", () => {
		it("NO_H1 fixture scores in warn range", async () => {
			const result = await contentStructureCheck.run(makeContext(NO_H1));

			expect(result.score).toBeGreaterThanOrEqual(40);
			expect(result.score).toBeLessThan(80);
			expect(result.status).toBe("warn");
		});

		it("GOOD_LANDING scores near warn/pass boundary (50-70)", async () => {
			const result = await contentStructureCheck.run(makeContext(GOOD_LANDING));

			expect(result.score).toBeGreaterThanOrEqual(40);
			expect(result.score).toBeLessThan(80);
		});

		it("score never exceeds 100", async () => {
			const result = await contentStructureCheck.run(makeContext(PERFECT_BLOG));

			expect(result.score).toBeLessThanOrEqual(100);
		});
	});

	describe("details object", () => {
		it("contains expected fields for well-structured page", async () => {
			const result = await contentStructureCheck.run(makeContext(PERFECT_BLOG));

			const details = result.details as Record<string, unknown>;
			expect(details.h1Count).toBe(1);
			expect(details.h1Text).toBeDefined();
			expect(details.hasMain).toBe(true);
			expect(details.headingHierarchyValid).toBe(true);
			expect(details.hasArticle).toBe(true);
			expect(details.hasSection).toBe(true);
			expect(details.paragraphCount as number).toBeGreaterThanOrEqual(5);
			expect(details.textToHtmlRatio as number).toBeGreaterThan(0);
			expect(details.headingLevels as number[]).toContain(1);
		});

		it("contains expected fields for empty page", async () => {
			const result = await contentStructureCheck.run(makeContext(EMPTY_BODY));

			const details = result.details as Record<string, unknown>;
			expect(details.h1Count).toBe(0);
			expect(details.h1Text).toBeNull();
			expect(details.hasMain).toBe(false);
			expect(details.paragraphCount).toBe(0);
			expect(details.headingCount).toBe(0);
		});
	});

	describe("issue severities", () => {
		it("assigns correct severities: missing H1=critical, missing semantic=important, short headings=nice-to-have", async () => {
			// Missing H1 → critical
			const noH1Result = await contentStructureCheck.run(makeContext(NO_H1));
			expect(
				noH1Result.issues.some((i) => i.severity === "critical" && i.message.includes("H1")),
			).toBe(true);

			// Missing <main> → important
			const noSemanticResult = await contentStructureCheck.run(makeContext(NO_SEMANTIC_HTML));
			expect(
				noSemanticResult.issues.some(
					(i) => i.severity === "important" && i.message.includes("<main>"),
				),
			).toBe(true);

			// Short headings → nice-to-have
			const shortHeadingsHtml = `<html><body><main><article>
				<h1>Kurz</h1>
				<h2>Auch</h2>
				<p>Ein substantieller Absatz mit mindestens fuenfzig Zeichen Länge für die korrekte Analyse der Seitenstruktur.</p>
			</article></main></body></html>`;
			const shortResult = await contentStructureCheck.run(makeContext(shortHeadingsHtml));
			expect(
				shortResult.issues.some((i) => i.severity === "nice-to-have" && i.message.includes("kurz")),
			).toBe(true);
		});
	});
});
