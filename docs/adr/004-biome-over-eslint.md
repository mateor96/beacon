# ADR-004: Biome statt ESLint + Prettier

**Status:** Accepted
**Datum:** 2026-03-13

## Kontext

ESLint + Prettier erfordern separate Konfiguration, können Konflikte erzeugen, und sind langsam in großen Monorepos.

## Entscheidung

Biome als einziger Linter + Formatter.

## Begründung

10-100x schneller als ESLint. Ein Tool statt zwei. Einheitliche Konfiguration in einer `biome.json`. Perfekt für Monorepo-Setup (ein Config für alle Packages).

## Konsequenzen

Weniger Community-Plugins als ESLint. Manche ESLint-Rules existieren nicht in Biome. Trade-off: Geschwindigkeit und Einfachheit > maximale Rule-Abdeckung.
