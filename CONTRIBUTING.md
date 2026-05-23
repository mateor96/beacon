# Contributing to Beacon

Thanks for considering a contribution. Beacon is a small project and the
contribution process is meant to stay lightweight.

## Code of conduct

Be kind. Assume good intent. Disagree on substance, not on people.

## Reporting bugs / requesting features

Open a GitHub Issue. Useful issues include:

- A clear, specific title (`scan returns 500 when llms.txt is > 1 MB`,
  not `scanner bug`).
- What you ran and what you expected.
- What actually happened (logs, screenshots).
- The version / commit you're on.

For features: explain the use case before proposing an implementation.

## Development setup

```bash
# Prereqs: Node 22+, pnpm 9+, Docker
cp .env.example .env
# At minimum set SCAN_ACCESS_SECRET (openssl rand -hex 32)

docker compose up -d redis db
pnpm install
pnpm db:migrate
pnpm dev
```

Run the full local CI before pushing:

```bash
pnpm ci:local
```

This runs lint, typecheck, tests, build, and the workspace policy checks.

## Pull requests

- Fork, branch from `main`, open a PR back to `main`.
- Keep PRs small and scoped to one concern. A 30-line PR gets reviewed in
  an hour, a 3000-line PR may sit for weeks.
- Include tests for new behaviour. The existing test suite is the
  contract — keep it passing.
- Match the surrounding code style. Run `pnpm lint:fix` before pushing.
- Reference the related issue in the PR description (`Closes #42`).

## Commit messages

We use lightweight conventional commits:

```
feat(scanner): detect malformed llms.txt header
fix(worker): retry scan job once on DNS failure
docs: clarify SCAN_ACCESS_SECRET in README
chore: bump drizzle-orm to 0.38
```

Scopes are optional but useful for routing review attention. Body lines
should explain *why*, not *what* — the diff already shows what.

## Adding a new scanner check

1. Create `packages/scanner/src/checks/<check-id>.ts` exporting a
   `Check` object.
2. Register it in `packages/scanner/src/index.ts`.
3. Add tests under `packages/scanner/src/__tests__/checks/`.
4. Update the README table.

See existing checks (e.g. `llms-txt.ts`, `webmcp.ts`) for the shape.

## Security

For security disclosures, see [SECURITY.md](./SECURITY.md). Don't open a
public issue for a vulnerability.
