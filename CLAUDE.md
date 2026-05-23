# Beacon - Projektregeln für Claude

## Quick-Start (lokale Entwicklung)

```bash
# Dependencies installieren
pnpm install

# Umgebungsvariablen
cp .env.example .env
# SCAN_ACCESS_SECRET via `openssl rand -hex 32` setzen.
# Anthropic-Key optional — ohne den Key sind AI-Fixes/Analyse deaktiviert.

# Infrastruktur starten (Redis + Postgres)
docker compose up -d redis db

# Datenbank-Migrations + RPC-Seed (chained)
pnpm db:migrate

# Entwicklungsserver (Web + Worker mit Hot-Reload)
pnpm dev
```

**Voraussetzungen:** Node.js 22+, pnpm 9+, Docker Desktop

Es gibt **keinen Login, keine Pläne und keine Tageslimits**. Jeder Visitor scannt
direkt anonym über `POST /api/scan`. Die Stripe- und Auth-Module liegen
deaktiviert unter `archive/` falls ein Fork sie reaktivieren möchte (siehe
`archive/README.md`).

## Pflicht: CONTEXT.md aktuell halten

Nach jeder größeren Änderung (neue Features, Architekturentscheidungen, abgeschlossene Phasen) **muss** `CONTEXT.md` aktualisiert werden:

- **Entscheidungslog** (Section 16): Neue Entscheidungen mit Datum und Begründung eintragen
- **Letzte Aktualisierung**: Datum im Header updaten
- **Produktscope/MVP-Definition**: Anpassen wenn sich der Scope ändert
- **Tech-Stack**: Aktualisieren wenn neue Technologien hinzukommen

Dies passiert automatisch am Ende jeder größeren Implementierung, nicht erst auf Nachfrage.

## Projektstruktur

- `CONTEXT.md` - Architektur-Überblick (zuerst lesen)
- `docs/adr/` - Architecture Decision Records
- `apps/web/` - Next.js 15 Frontend + thin API Routes
- `apps/worker/` - BullMQ Worker (Scan, Fix, Report, Monitoring)
- `packages/scanner/` - Scanner-Engine mit Plugin-System (14 Checks)
- `packages/db/` - Drizzle ORM + Migrations
- `packages/ai/` - Claude API + Fix-Generatoren + Validatoren
- `packages/monitoring/` - AI Visibility Tracking
- `packages/notifications/` - Email-Templates + Send-Adapter
- `packages/api-sdk/` - Public API Client SDK
- `packages/report/` - PDF Report Generation
- `packages/ui/` - Shared Component Library
- `packages/shared/` - Types, Constants, Validation
- `archive/billing/` - Deaktivierte Stripe-Integration (re-enablebar)
- `archive/auth/` - Deaktivierte Supabase-Auth-Integration (re-enablebar)

## Tech-Stack

- Monorepo: Turborepo + pnpm Workspaces
- Frontend: Next.js 15 + Tailwind CSS (TypeScript)
- Worker: BullMQ + Redis (16 Queues, u.a. scan, fix, report, analysis, ai-visibility, monitoring, crawl)
- ORM: Drizzle ORM (Postgres)
- Datenbank: Postgres (Docker)
- Auth: keine (anonymes Tool); Code für Supabase Auth liegt unter `archive/auth/`
- KI: Claude API (Fix-Generierung + Semantische Analyse + Report-Texte) — optional, deaktiviert ohne `ANTHROPIC_API_KEY`
- Payments: keine; Stripe-Code liegt unter `archive/billing/`
- Hosting: jeder VPS mit Docker, oder lokal via `docker compose up`
- Linter/Formatter: Biome
- Tests: Vitest
- CI: GitHub Actions (lint + typecheck + test + build)

## Git-Workflow

- **Neue Features IMMER auf einem eigenen Branch entwickeln**, der von `main`/`master` abzweigt
- Branch benennen nach Feature, z.B. `feature/auth`, `feature/new-checks`
- Nach Fertigstellung: Branch pushen und Pull Request erstellen
- Niemals direkt auf `main`/`master` committen
- **NIEMALS `Co-Authored-By` in Commit-Messages verwenden.** Claude Code darf sich nicht als Co-Author eintragen.

## Issue-Driven Development (PFLICHT)

**Jedes Feature, jeder Bug, jede Aufgabe MUSS als GitHub Issue existieren, BEVOR Arbeit beginnt.**

- Kein Branch ohne zugehöriges Issue
- Kein PR ohne Issue-Referenz (z.B. `Closes #42`)
- Issues sind die einzige Quelle der Wahrheit für "was wird gebaut und warum"
- Branch-Namen folgen dem Pattern: `feat/#42-feature-name`, `fix/#43-bug-description`
- Jedes Issue braucht mindestens: Titel, Beschreibung, Label(s), Milestone

### Workflow:
1. Issue erstellen (oder bestehendes Issue zuweisen)
2. Branch vom Issue erstellen: `feat/#42-feature-name`
3. Implementieren
4. PR erstellen mit `Closes #42` im Body
5. Review (Agent + Self-Review)
6. Merge → Issue wird automatisch geschlossen

## GitHub Project Board

Ein GitHub Project Board mit folgenden Spalten wird für die gesamte Entwicklung genutzt:

| Spalte | Beschreibung |
|---|---|
| **Backlog** | Alle offenen Issues, noch nicht priorisiert |
| **This Week** | Issues die diese Woche bearbeitet werden |
| **In Progress** | Aktuell in Bearbeitung (max. 3 gleichzeitig) |
| **Review** | PR erstellt, wartet auf Review/Merge |
| **Done** | Abgeschlossen und gemerged |

WIP-Limit: Maximal 3 Issues gleichzeitig "In Progress".

## Release- und Tagging-Strategie

- **Semantic Versioning:** `MAJOR.MINOR.PATCH` (z.B. v0.1.0)
- **Git Tags** bei jedem Release: `git tag -a v0.1.0 -m "Phase 1 complete"`
- **Releases auf GitHub** mit Changelog

| Version | Meilenstein | Zeitpunkt |
|---|---|---|
| v0.1.0 | Foundation complete (Monorepo, Docker, Packages) | Ende Phase 1 (Woche 4) |
| v0.2.0 | Core Product (Web App, Stripe, Deploy) | Ende Phase 2 (Woche 8) |
| v0.3.0 | Monitoring + Crawl | Ende Phase 3 (Woche 12) |
| v0.4.0 | Scale Features (API, White-Label) | Ende Phase 4 (Woche 16) |
| v1.0.0 | Public Launch | Ende Phase 5 (Woche 18) |

Pre-Release-Versionen (z.B. v0.3.0-beta.1) für Closed-Beta-Phasen.

## GitHub Labels

Folgende Labels werden fuer CI Review Agents genutzt (Agents geplant fuer Phase 2):

| Label | Farbe | Agent (geplant) |
|---|---|---|
| `scanner` | `#0e8a16` | Scanner Consistency (geplant) |
| `billing` | `#d93f0b` | Billing Integrity (geplant) |
| `monitoring` | `#6f42c1` | Monitoring Consistency (geplant) |
| `api` | `#0075ca` | API Contract (geplant) |
| `crawler` | `#e4e669` | — (manueller Review) |
| `notifications` | `#fbca04` | — (manueller Review) |
| `security` | `#b60205` | Security Reviewer (geplant) |
| `ui` | `#1d76db` | — |
| `worker` | `#fbca04` | — |
| `infra` | `#5319e7` | — |
| `docs` | `#0075ca` | — |
| `bug` | `#d73a4a` | — |
| `feature` | `#a2eeef` | — |
| `P0-critical` | `#b60205` | — (Sofort fixen) |
| `P1-high` | `#d93f0b` | — (Diese Woche) |
| `P2-medium` | `#fbca04` | — (Dieser Sprint) |

## Implementierungs-Workflow: Waves of Agents

Bei Features wird in Wellen (Waves) von je 5 parallelen Agents gearbeitet:

1. **Wave 1 — Plan:** 5 Agents explorieren Codebase und planen
2. **Wave 2 — Implement:** 5 Agents implementieren parallel verschiedene Dateien
3. **Wave 3 — Review:** 5 Agents reviewen die Implementierung
4. **Wave 4 — Fix:** 5 Agents fixen gefundene Issues
5. Wiederhole Wave 3-4 bis alle Reviewer zufrieden sind

Jede Wave wird als einzelne Nachricht mit 5 parallelen Task-Tool-Aufrufen dispatcht.

## Pflicht: Kosten berechnen bei neuen Features

Nur bei Features, die **zusätzliche laufende Kosten** verursachen (z.B. externe API-Calls, neue Infrastruktur). Reine UI-Änderungen, statische Checks oder Refactorings brauchen keine Kostenberechnung. Wenn Mehrkosten zu erwarten sind, diese Dateien aktualisieren:

- Kostenaufschlüsselung-Dokumente bei Bedarf unter `docs/` anlegen
- `CONTEXT.md` — Plan-Beschreibungen falls sich Feature-Gates ändern

Berechnung: Input-Tokens × Preis + Output-Tokens × Preis = Kosten pro Aufruf.

## Sprache

- Code und Kommentare: Englisch
- UI-Texte und Docs: Deutsch
- User-facing Messages in der App: Deutsch
