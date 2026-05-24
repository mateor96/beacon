# ADR-001: Operator-UI über eine `(operator)`-Route-Group

**Status:** Accepted
**Datum:** 2026-05-24

## Kontext

Beacon hat eine umfangreiche Backend-Fläche (18 BullMQ-Queues, Cron-Jobs, ~22
`@beacon/db`-Query-Namespaces), von der nur ein Bruchteil im Web-UI sichtbar ist.
`apps/web/src/app/layout.tsx` rendert ein nacktes `{children}` ohne globale
Navigation, sodass die vorhandenen Operator-Seiten (`/monitoring`,
`/cms-connections`, `/webhooks`, `/admin/api-token`) verwaiste Inseln sind, die
nur durch direkte URL-Eingabe erreichbar sind. Ganze Feature-Bereiche
(Citations, Reddit, Wettbewerber, Alerts/Zeitpläne, Dead-Letter-Queue,
E-Mail-Log, Provider-/Queue-Health) haben keine UI.

Das v0.3-Epic (#32) macht alle Backend-Features im Browser bedienbar. Diese ADR
hält die UI-Architektur-Entscheidung fest.

## Entscheidung

1. **`(operator)`-Route-Group mit gemeinsamem Layout.** Alle Operator-Seiten
   liegen unter `apps/web/src/app/(operator)/` mit einem geteilten
   `layout.tsx` (Sidebar via `components/operator/operator-nav.tsx`). Route
   Groups sind URL-transparent — bestehende Pfade bleiben unverändert.
2. **Öffentliche/anonyme Seiten bleiben außerhalb der Group** (Landing, Scan,
   Public-Report, Legal) und behalten `index: true` + Marketing-Navbar.
3. **`noindex` einmalig im Group-Layout** statt pro Seite.
4. **Projekt-bezogene Features werden Tabs** auf `/monitoring/[id]` (Reddit,
   Wettbewerber, Zeitpläne, Alerts), da sie über `project.id` skaliert sind
   (Reddit `brandId == project.id`). **Citations bleiben top-level**
   (instance-weit, scan-bezogen).
5. **Settings = read-only Status-Seite**, die env liest und nie Secrets in die
   DB schreibt (analog zur bestehenden `/admin/api-token`-Seite).

## Begründung

- Eine geteilte Layout-Group hält die Navigation an *einer* Stelle, erzwingt
  `noindex` strukturell und trennt öffentliche von Operator-Flächen sauber.
  Die Alternative (eine `<OperatorNav>`-Komponente pro Seite importiert) wurde
  verworfen: sie dupliziert die Navigation, driftet leicht auseinander und wird
  auf neuen Seiten leicht vergessen.
- Zwei verifizierte Fakten prägen das Epic:
  - **Citations sind heute leer:** anonyme Scans werden mit `userId: null`
    angelegt (`api/scan/route.ts`), aber Citation-Queries filtern
    `eq(scans.userId, userId)` — ein userId-Filter trifft NULL nie. → Es
    braucht instance-weite Query-Varianten (Phase 3), keine "System-Profil
    auflösen"-Lösung.
  - **Health braucht keinen Worker-HTTP-Hop:** die Web-App hängt bereits von
    `@beacon/queue`/`@beacon/ai` ab. Queue-Metriken, Provider-Key-Status, DLQ
    und E-Mail-Log sind in-process lesbar (Phase 1). Nur Cron-Last/Next-Run
    lebt ausschließlich im Worker-Prozess → optional/graceful.

## Konsequenzen

- **Positiv:** eine Navigations-Quelle (`nav-config.ts`), zentrales `noindex`,
  keine URL-Änderungen (Links/Tests bleiben gültig), klare Public/Operator-
  Trennung. Phasen sind unabhängig hinter der Shell ausbaubar.
- **Negativ/Aufwand:** einmaliges Verschieben der Operator-Ordner in die Group.
  `@/`-Alias-Imports sind unbetroffen. `/docs/api` (Full-Page Scalar-Referenz)
  bleibt außerhalb der Group und wird nur verlinkt.
- **Folge-Risiko:** `monitoring_schedules` werden vom Sweep-Cron aktuell
  ignoriert — die Zeitplan-UI (Phase 2) darf nicht implizieren, dass Zeitpläne
  Läufe auslösen, bis ein Dispatcher nachgezogen wird.
