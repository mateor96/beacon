import type { CheckContext } from "@beacon/shared";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

const { default: jsRenderingCheck } = await import("../../checks/js-rendering.js");

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

const STATIC_HTML = `<html>
<head><title>Statische Seite</title><meta name="description" content="Eine vollständig statische HTML-Seite ohne JavaScript"></head>
<body>
<header><nav><a href="/">Startseite</a><a href="/kontakt">Kontakt</a></nav></header>
<main>
<article>
<h1>Vollständig statische HTML-Seite ohne JavaScript</h1>
<p>Diese Seite wird vollständig als statisches HTML ausgeliefert und benoetigt keinerlei JavaScript für die Darstellung der Inhalte. Crawler können alle Informationen sofort lesen.</p>
<h2>Vorteile von statischem HTML für Suchmaschinen</h2>
<p>Statisches HTML ist sofort lesbar für alle Crawler und KI-Systeme ohne zusätzliche Verarbeitung oder Rendering-Schritte. Die Inhalte sind direkt im Quellcode sichtbar.</p>
<p>Die Investition in qualitativ hochwertige Inhalte zahlt sich langfristig aus und staerkt die digitale Sichtbarkeit eines Unternehmens nachhaltig und zuverlässig.</p>
<ul><li>Schnelle Ladezeiten</li><li>Keine JavaScript-Abhängigkeit</li><li>Maximale Crawlbarkeit</li></ul>
</article>
</main>
<footer><p>Copyright 2024</p></footer>
</body>
</html>`;

const NEXT_JS_SSR = `<html>
<head><title>Next.js SSR Seite</title><meta name="description" content="Server-seitig gerenderte Next.js Seite"><meta property="og:title" content="Next.js SSR"><link rel="canonical" href="https://example.com"></head>
<body>
<div id="__next">
<header><nav><a href="/">Home</a></nav></header>
<main>
<article>
<h1>Server-seitig gerenderte Next.js Seite mit vollständigem Inhalt</h1>
<p>Diese Seite wurde mit Next.js serverseitig gerendert und enthaelt alle Inhalte direkt im HTML-Quellcode für optimale Indexierung durch KI-Crawler und Suchmaschinen.</p>
<h2>Vorteile von Server-Side Rendering mit Next.js</h2>
<p>Server-Side Rendering stellt sicher dass alle Inhalte beim ersten Laden verfügbar sind und von Crawlern sofort gelesen werden können ohne JavaScript auszufuehren.</p>
<p>Die Hydration erfolgt clientseitig aber der gesamte initiale Inhalt ist bereits im HTML vorhanden und vollständig lesbar für alle Crawler.</p>
</article>
</main>
</div>
<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{}}}</script>
<script src="/_next/static/chunks/main.js" defer></script>
</body>
</html>`;

const SPA_SHELL = `<html>
<head>
<title>React App</title>
<link rel="stylesheet" href="/static/css/main.css">
</head>
<body>
<noscript>You need to enable JavaScript to run this app.</noscript>
<div id="root"></div>
<script src="/static/js/bundle.js"></script>
<script src="/static/js/vendors~main.chunk.js"></script>
<script src="/static/js/main.chunk.js"></script>
</body>
</html>`;

const ANGULAR_SPA = `<html lang="de">
<head>
<meta charset="utf-8">
<title>Angular App</title>
<base href="/">
</head>
<body>
<app-root></app-root>
<script src="runtime.js" type="module"></script>
<script src="polyfills.js" type="module"></script>
<script src="main.js" type="module"></script>
</body>
</html>`;

const PARTIAL_HYDRATION = `<html>
<head><title>Teilweise Hydration</title><meta name="description" content="Produkt mit partieller Hydration"></head>
<body>
<header><nav><a href="/">Home</a></nav></header>
<main>
<h1>Produktseite mit partieller Hydration und statischem Inhalt</h1>
<p>Diese Seite enthaelt server-gerendertes HTML für die wichtigsten Inhalte aber nutzt JavaScript für interaktive Komponenten wie Bildergalerien und Bewertungen.</p>
<div id="product-gallery" data-hydrate="true"></div>
<h2>Produktbeschreibung und technische Details</h2>
<p>Die Produktbeschreibung wird statisch ausgeliefert und ist für alle Crawler sofort sichtbar und lesbar ohne JavaScript auszufuehren.</p>
<div id="reviews-widget"></div>
</main>
<script src="/assets/hydrate.js"></script>
<script src="/assets/widgets.js"></script>
</body>
</html>`;

const ASTRO_STATIC = `<html lang="de">
<head><title>Astro Seite</title><meta name="description" content="Astro-generierte statische Seite"></head>
<body>
<header data-astro-cid-abc123>
<nav data-astro-cid-abc123><a href="/">Start</a><a href="/blog">Blog</a></nav>
</header>
<main data-astro-cid-def456>
<article data-astro-cid-def456>
<h1>Astro-generierte statische Seite mit optimaler KI-Sichtbarkeit</h1>
<p>Diese Seite wurde mit Astro als vollständig statisches HTML generiert und enthaelt keinerlei clientseitiges JavaScript für die Inhaltsdarstellung.</p>
<h2>Warum Astro ideal für KI-optimierte Webseiten ist</h2>
<p>Astro rendert standardmaessig alle Komponenten zu statischem HTML und sendet nur bei Bedarf JavaScript für interaktive Inseln an den Browser.</p>
<p>Das Islands-Architecture-Modell von Astro stellt sicher dass der Grossteil der Seite ohne JavaScript funktioniert und sofort indexierbar ist.</p>
</article>
</main>
<footer data-astro-cid-ghi789><p>Erstellt mit Astro</p></footer>
</body>
</html>`;

const EMPTY_BODY = "<html><body></body></html>";

const NUXT_SSR = `<html>
<head><title>Nuxt SSR Seite</title><meta name="description" content="Nuxt server-seitig gerendert"></head>
<body>
<div id="__nuxt">
<div id="__layout">
<main>
<h1>Server-seitig gerenderte Nuxt Seite mit vollständigem HTML-Inhalt</h1>
<p>Diese Nuxt-Anwendung nutzt Server-Side Rendering um alle Inhalte beim ersten Request als vollständiges HTML auszuliefern für optimale Crawler-Sichtbarkeit.</p>
<h2>Nuxt Universal Rendering für beste KI-Sichtbarkeit</h2>
<p>Mit Universal Rendering kombiniert Nuxt die Vorteile von Server-Side Rendering mit clientseitiger Interaktivität und schneller Navigation zwischen Seiten.</p>
<p>Crawler und KI-Systeme erhalten sofort den vollständigen Seiteninhalt ohne JavaScript ausführen zu müssen für alle Inhalte.</p>
</main>
</div>
</div>
<script>window.__NUXT__={data:{page:{title:"SSR"}}}</script>
<script src="/_nuxt/app.js" defer></script>
</body>
</html>`;

// ── Tests ───────────────────────────────────────────────────

describe("js-rendering check", () => {
	describe("metadata", () => {
		it("has correct id, category, and severity", () => {
			expect(jsRenderingCheck.id).toBe("js-rendering");
			expect(jsRenderingCheck.category).toBe("readability");
			expect(jsRenderingCheck.severity).toBe("critical");
		});
	});

	describe("pass scenarios — fully rendered content", () => {
		it("static HTML scores pass", async () => {
			const result = await jsRenderingCheck.run(makeContext(STATIC_HTML));
			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(80);
		});

		it("Next.js SSR scores pass and detects framework", async () => {
			const result = await jsRenderingCheck.run(makeContext(NEXT_JS_SSR));
			expect(result.score).toBeGreaterThanOrEqual(80);
			expect(result.status).toBe("pass");
			expect(result.details?.detectedFramework).toBe("Next.js");
		});

		it("Nuxt SSR scores pass and detects framework", async () => {
			const result = await jsRenderingCheck.run(makeContext(NUXT_SSR));
			expect(result.score).toBeGreaterThanOrEqual(80);
			expect(result.status).toBe("pass");
			expect(result.details?.detectedFramework).toBe("Nuxt");
		});

		it("Astro static scores pass and detects framework", async () => {
			const result = await jsRenderingCheck.run(makeContext(ASTRO_STATIC));
			expect(result.status).toBe("pass");
			expect(result.score).toBeGreaterThanOrEqual(80);
			expect(result.details?.detectedFramework).toBe("Astro");
		});
	});

	describe("warn scenarios — partial rendering", () => {
		it("partial hydration scores in warn range", async () => {
			const result = await jsRenderingCheck.run(makeContext(PARTIAL_HYDRATION));
			expect(result.score).toBeGreaterThanOrEqual(30);
			expect(result.score).toBeLessThan(80);
		});
	});

	describe("fail scenarios — JS-dependent rendering", () => {
		it("SPA shell scores < 25", async () => {
			const result = await jsRenderingCheck.run(makeContext(SPA_SHELL));
			expect(result.status).toBe("fail");
			expect(result.score).toBeLessThan(25);
			expect(result.details?.spaRootDetected).toBe(true);
		});

		it("Angular SPA scores < 20", async () => {
			const result = await jsRenderingCheck.run(makeContext(ANGULAR_SPA));
			expect(result.status).toBe("fail");
			expect(result.score).toBeLessThan(20);
			expect(result.details?.spaRootDetected).toBe(true);
		});

		it("empty body scores fail", async () => {
			const result = await jsRenderingCheck.run(makeContext(EMPTY_BODY));
			expect(result.status).toBe("fail");
			expect(result.score).toBeLessThan(15);
		});
	});

	describe("score ordering", () => {
		it("SSR pages score much higher than SPA pages", async () => {
			const nextScore = (await jsRenderingCheck.run(makeContext(NEXT_JS_SSR))).score;
			const spaScore = (await jsRenderingCheck.run(makeContext(SPA_SHELL))).score;
			const emptyScore = (await jsRenderingCheck.run(makeContext(EMPTY_BODY))).score;

			expect(nextScore).toBeGreaterThanOrEqual(80);
			expect(spaScore).toBeLessThan(25);
			expect(emptyScore).toBeLessThan(spaScore + 5);
		});
	});

	describe("details object", () => {
		it("contains expected fields for SSR page", async () => {
			const result = await jsRenderingCheck.run(makeContext(NEXT_JS_SSR));
			const details = result.details as Record<string, unknown>;

			expect(details.detectedFramework).toBe("Next.js");
			expect(details.renderingType).toBe("ssr");
			expect(details.bodyWordCount).toBeGreaterThan(50);
			expect(details.externalScriptCount).toBeGreaterThanOrEqual(1);
			expect(details.hasTitle).toBe(true);
			expect(details.hasMetaDescription).toBe(true);
		});

		it("contains expected fields for SPA page", async () => {
			const result = await jsRenderingCheck.run(makeContext(SPA_SHELL));
			const details = result.details as Record<string, unknown>;

			expect(details.spaRootDetected).toBe(true);
			expect(details.spaRootId).toBe("root");
			expect(details.renderingType).toBe("csr-spa");
			expect(details.bodyWordCount).toBeLessThan(10);
			expect(details.externalScriptCount).toBeGreaterThanOrEqual(3);
		});
	});

	describe("issue messages", () => {
		it("SPA shell produces critical issues about empty content", async () => {
			const result = await jsRenderingCheck.run(makeContext(SPA_SHELL));
			expect(result.issues.some((i) => i.severity === "critical")).toBe(true);
		});

		it("SSR page with full content has no critical issues", async () => {
			const result = await jsRenderingCheck.run(makeContext(STATIC_HTML));
			expect(result.issues.some((i) => i.severity === "critical")).toBe(false);
		});
	});
});
