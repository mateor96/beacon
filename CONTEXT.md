# Beacon — Architecture Overview

Project context for contributors. For day-to-day commands see `README.md` and `CLAUDE.md`.

## Vision

An open-source tool that audits any website for how well AI agents
(ChatGPT, Claude, Perplexity, Gemini, etc.) can read, understand, and
interact with it — and generates concrete fixes. Self-hosted, anonymous,
no login.

Think of it as "Lighthouse for the agentic web."

## Readiness-Level Model

The scanner reports a 0–3 readiness level alongside a 0–100 score:

| Level | Name | What it means | Relevant standards |
|-------|------|---------------|--------------------|
| 0 | Invisible | AI cannot meaningfully process the site | — |
| 1 | Readable | AI can read and cite content | `llms.txt`, Schema.org/JSON-LD, `robots.txt`, structured content |
| 2 | Interactive | An AI agent can interact with the site | WebMCP, `AGENTS.md`, form tool-attributes |
| 3 | Transactional | An AI agent can complete purchases/bookings | UCP, ACP, payment integration |

## What's in scope

- **Audit**: fetch a URL, run 14 checks, compute a readiness score.
- **Diagnose**: surface specific issues (missing `llms.txt`, no JSON-LD,
  JS-rendered content, missing WebMCP attributes, etc.).
- **Fix generation**: produce ready-to-paste artifacts (`llms.txt`,
  JSON-LD, WebMCP markup, `AGENTS.md`) via the Claude API. Optional —
  disabled when `ANTHROPIC_API_KEY` is unset.
- **PDF reports**: rendered server-side via Puppeteer.

## What's out of scope

- Website creation or rebuild
- Classical SEO (only GEO/AEO)
- Direct deployment of fixes — users download artifacts and apply them
  themselves

## Tech stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend** (`apps/web`): Next.js 15 + Tailwind, anonymous-only
- **Worker** (`apps/worker`): BullMQ on Redis, 16 queues
- **Database** (`packages/db`): Drizzle ORM on Postgres
- **Scanner** (`packages/scanner`): plugin-based, 14 checks
- **AI** (`packages/ai`): Anthropic Claude SDK, optional
- **Reports** (`packages/report`): Puppeteer-rendered PDFs
- **Linter / formatter**: Biome
- **Tests**: Vitest + Playwright

No auth, no billing, no tenant model. Code for those concerns lives under
`archive/` and can be re-enabled by forks — see `archive/README.md`.

### Operator console (v0.3)

All operator surfaces live under the `(operator)` route group with a shared
shell + sidebar (`apps/web/src/app/(operator)/`, see `docs/adr/001`). It exposes
monitoring projects (with per-project tabs: Übersicht, Wettbewerber, Reddit,
Alerts), instance-wide Citations, manual AI-visibility sweeps + schedules, a
Status/Health page (provider keys, queue health, DLQ, email log), and CRUD for
CMS connections, webhooks, competitors and alerts. Most config is env-only, but
secrets that the operator needs to rotate live encrypted in the DB (AES-256-GCM,
via `crypto-aes-gcm.ts`): CMS credentials and, since v0.4, **AI provider keys**
managed from the Status page (DB keys override env at runtime, no restart;
`PROVIDER_KEYS_KEY` encrypts them). The single-tenant `INSTANCE_USER_ID` sentinel
profile (seeded by `db:migrate`) backs feature tables that still carry a
NOT NULL `userId` FK (e.g. alerts).

Two surfaces are stored-but-not-yet-evaluated (the UI says so): monitoring
**schedules** (the daily sweep cron doesn't yet consume `monitoring_schedules`)
and **alerts** (no evaluator dispatches them yet). Both await a worker-side
dispatcher.

Multi-page crawl (#25) and webhook delivery (#24) — previously reserved — are
now implemented as of v0.2.

## Repository layout

```
apps/
  web/          Next.js frontend + thin API routes
  worker/       BullMQ worker (scan, fix, report, monitoring, …)
packages/
  scanner/      Scanner engine + 14 check plugins
  ai/           Claude API client + generators + validators
  db/           Drizzle schema + migrations
  queue/        BullMQ queue/worker setup
  monitoring/   AI-visibility tracking
  notifications/Email templates + send adapters
  report/       PDF report renderer
  shared/       Types, constants, validation
  ui/           Shared React components
  api-sdk/      Public API client SDK
  integrations/ Looker Studio connector, etc.
archive/
  auth/         Disabled Supabase auth (re-enablable)
  billing/      Disabled Stripe billing (re-enablable)
docs/
  adr/          Architecture Decision Records
  PRINCIPLES.md, VISION.md, queue-retry-policy.md
```

## Architectural decisions

Decisions live under `docs/adr/` as Architecture Decision Records.
Significant deltas should land as a new ADR rather than free-form notes
in this file.

## See also

- `README.md` — quick start, what the tool does, how to run it
- `CLAUDE.md` — contributor workflow rules
- `archive/README.md` — how to re-enable auth or billing in a fork
