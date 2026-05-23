# ADR-001: Turborepo Monorepo

**Status:** Accepted
**Datum:** 2026-03-13

## Kontext

Der Prototyp war eine monolithische Next.js-App. Scanner-Checks, Billing-Logik, AI-Integration und DB-Queries waren in `src/lib/` vermischt. Änderungen an der Billing-Logik konnten Scanner-Tests brechen.

## Entscheidung

Turborepo + pnpm Workspaces mit isolierten Packages (`@beacon/scanner`, `@beacon/billing`, etc.).

## Begründung

Package-Isolation erzwingt klare Boundaries. Jedes Package hat eigene Tests, eigenen Build, eigene Dependencies. Turborepo cached Builds intelligent. pnpm ist schneller und disk-effizienter als npm/yarn.

## Konsequenzen

Höherer initialer Setup-Aufwand. Jedes Package braucht `package.json` + `tsconfig.json`. Dafür: unabhängige Testbarkeit, klare Ownership, parallelisierte Builds.
