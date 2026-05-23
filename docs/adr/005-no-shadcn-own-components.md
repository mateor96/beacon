# ADR-005: Eigene Components statt shadcn/Radix

**Status:** Accepted
**Datum:** 2026-03-13

## Kontext

shadcn/ui ist populär, aber kopiert hunderte Dateien in das Projekt. Radix hat komplexe Accessibility-Patterns die schwer zu debuggen sind.

## Entscheidung

Eigene Component Library (`@beacon/ui`) mit Tailwind CSS.

## Begründung

Volle Kontrolle über jeden Component. Kein Vendor-Lock auf shadcn-Updates. Components sind exakt auf Beacon-Needs zugeschnitten — kein Ballast. Team versteht jeden Line of Code.

## Konsequenzen

Mehr initialer Aufwand für Accessibility (ARIA, Keyboard Nav). Weniger "out of the box" Komponenten. Trade-off: Langfristige Wartbarkeit > kurzfristige Geschwindigkeit.
