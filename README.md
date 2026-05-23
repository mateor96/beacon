# Beacon — Agentic Web Readiness

> Lighthouse for the agentic web. Self-hostable, no login, no quotas.

Beacon scans a website and tells you how well it is prepared for AI agents
like ChatGPT, Perplexity, Claude and Gemini. It runs 14 checks across three
readiness levels (Readable → Interactive → Transactional) and gives you a
0–100 score plus concrete fixes you can deploy.

## What it checks

| Level | Checks |
|---|---|
| **L1 — Readable** | `llms-txt`, `robots-txt`, `schema-org`, `sitemap-xml`, `agents-md`, `meta-tags`, `content-structure`, `semantic-quality`, `citation-readiness`, `content-freshness`, `faq-schema` |
| **L2 — Interactive** | `webmcp` |
| **L0 — Crawlability** | `performance`, `js-rendering` |

## Quick start

```bash
# Prereqs: Node 22+, pnpm 9+, Docker
cp .env.example .env
# At minimum set: SCAN_ACCESS_SECRET (openssl rand -hex 32)

docker compose up -d redis db
pnpm install
pnpm db:migrate     # runs drizzle migrations + seeds the merge_scan_fixes RPC
pnpm dev            # web on :3000, worker on :3001
```

Then `POST http://localhost:3000/api/scan` with `{"url":"https://example.com"}`.
The response includes a signed `resultsUrl` like `/results/<scan-id>?access=…`
that lets you view the full report.

## Optional features

| Feature | Required env |
|---|---|
| AI fix generation, semantic analysis | `ANTHROPIC_API_KEY` |
| AI visibility tracking (across providers) | `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, `PERPLEXITY_API_KEY` |
| Outbound email | `RESEND_API_KEY` |
| Error tracking | `SENTRY_DSN` |

Without these keys the corresponding routes simply 4xx instead of breaking.

## Architecture

- `apps/web/` — Next.js 15 frontend + thin API routes
- `apps/worker/` — BullMQ workers (scan, fix, report, analysis, ai-visibility, …)
- `packages/scanner/` — 14 check plugins + scanner engine with SSRF protection
- `packages/db/` — Drizzle ORM, schema, migrations
- `packages/ai/` — Claude API wrappers, fix generators
- `packages/monitoring/` — AI visibility tracking
- `packages/notifications/` — email templates + send adapters
- `packages/report/` — PDF report generation (Puppeteer)
- `packages/shared/` — types, constants, validation
- `archive/billing/` — disabled Stripe integration (see `archive/README.md`)
- `archive/auth/` — disabled Supabase SSR auth (see `archive/README.md`)

## License

MIT.

## Acknowledgements

Build on top of:
[Next.js](https://nextjs.org/) ·
[Drizzle](https://orm.drizzle.team/) ·
[BullMQ](https://docs.bullmq.io/) ·
[Hono](https://hono.dev/) ·
[Claude API](https://docs.claude.com/) ·
[Biome](https://biomejs.dev/) ·
[Vitest](https://vitest.dev/)
