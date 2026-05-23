# ADR-008: CI Pipeline und Branch Protection

**Status:** Accepted
**Datum:** 2026-03-14

## Kontext

Das Monorepo braucht eine CI-Pipeline die bei jedem PR Lint, Typecheck, Test und Build ausführt. Als Solo-Dev-Projekt brauchen wir Branch Protection Rules die PRs erzwingen ohne Review-Overhead.

## Entscheidung

### CI Pipeline (ci.yml)

- **Single Job** "Lint, Typecheck, Test, Build" statt paralleler Jobs (einfacher, schneller bei kleinem Repo)
- **Lint:** `biome check .` direkt (nicht via Turbo) — ein Config für alle Packages
- **Typecheck:** `turbo run typecheck` (nutzt `^build` Dependency)
- **Test:** `vitest run --passWithNoTests` (nutzt `vitest.config.ts` mit `test.projects`, kein Boilerplate in Package-JSONs nötig)
- **Build:** `turbo run build`
- **Trigger:** Push auf `main` + alle Pull Requests
- **Concurrency:** `cancel-in-progress` pro Branch

### Branch Protection (main)

| Regel | Einstellung |
|-------|-------------|
| Require pull request | Ja (keine direkten Pushes) |
| Required status check | `CI / Lint, Typecheck, Test, Build` |
| Required reviews | 0 (Solo-Dev) |
| Require linear history | Ja (Squash-Merge) |
| Allow force pushes | Nein |
| Include administrators | Ja |

### Branch-Naming Convention

- `feat/#<issue>-beschreibung` — Neues Feature
- `fix/#<issue>-beschreibung` — Bugfix
- `chore/#<issue>-beschreibung` — Maintenance

### Integration Tests (integration-tests Job)

- Postgres 16-alpine als Service Container (User/DB: beacon_test)
- Migrationen laufen im `beforeAll` Hook der Integration Tests (selbststaendig)
- Env: nur `DATABASE_URL` benoetigt (kein dotenv-cli, kein Redis)
- Läuft parallel zum `ci` Job (kein `needs:` — wall-clock-Optimierung)
- Aktuell: `packages/db` Deletion-Tests (DSGVO Account-Löschung)

### Release-Gate Tiers

| Tier | Workflow / Job | Blocks Merge? | Promotion |
|------|---------------|---------------|-----------|
| 1 | CI / Lint, Typecheck, Test, Build, Verify | Ja (required status check) | — |
| 2 | CI / DB Integration Tests | Nein (informational) | Nach 2 Wochen stabiler gruener Runs |
| 2 | E2E Tests / Playwright E2E | Nein (hängt von Secrets ab) | Nach stabiler Supabase-Test-Infra |

### Coverage

- Aktiviert via `--coverage` Flag im Test-Schritt des `ci` Jobs
- Per-Package Konfiguration in `vitest.config.ts` (billing: 80% Threshold)
- Ausgabe auf stdout — sichtbar in CI-Logs, kein externer Dienst
- Provider: `@vitest/coverage-v8`

### Env-Variablen-Strategie

| Workflow | Variablen | Quelle |
|----------|-----------|--------|
| ci.yml (ci Job) | keine | Tests sind vollständig gemockt |
| ci.yml (integration-tests Job) | `DATABASE_URL` | Job-Level env |
| e2e.yml | `DATABASE_URL`, `REDIS_*`, Supabase, E2E-Credentials | Job-Level env + GitHub Secrets |
| deploy.yml | SSH-Credentials | GitHub Secrets |

### Agent Review (geplant)

- `agent-review.yml` wurde entfernt — alle 5 Jobs waren TODO-Stubs (#43)
- Implementierung geplant für Phase 2 (Woche 8) mit Claude Code Action
- 5 Agents: Security, Scanner, Billing, Monitoring, API Contract

### Enabler-Issues

- #39: CI Migrationsjob gegen echte Postgres-DB — gelöst durch `integration-tests` Job
- #96: Supabase E2E Test-Projekt und GitHub Secrets — Voraussetzung für stabile E2E-Tests

## Begründung

- **Single Job statt 4 parallele:** Bei < 5min Laufzeit spart ein Job den 4-fachen pnpm-Install-Overhead. Aufsplitten wenn Pipeline langsam wird.
- **vitest run statt turbo test:** `vitest.config.ts` mit `test.projects` steuert alle Packages zentral. Kein `"test"`-Script in jeder `package.json` nötig.
- **Lint direkt statt via Turbo:** Biome arbeitet bereits rekursiv auf dem Root. Turbo-Overhead unnötig.
- **0 Reviews:** Solo-Dev-Phase. CI-Checks ersetzen manuelles Review für Code-Qualität.

## Konsequenzen

- Kein kaputter Code auf `main` dank Required Status Checks
- Squash-Merge hält Git-History sauber
- Kein Force-Push möglich (gewollt)
- TODO: `deploy.yml` an CI-Erfolg koppeln (eigenes Issue)
- TODO: CI parallelisieren wenn Pipeline > 5min dauert (eigenes Issue)
- Integration-Tests Job als Tier 2 (informational) hinzugefuegt (#43, 2026-03-22)
- Coverage via `--coverage` Flag sichtbar gemacht (#43, 2026-03-22)
- `agent-review.yml` entfernt (TODO-Stubs, #43, 2026-03-22)
