# ADR-002: Drizzle ORM statt raw Supabase Client

**Status:** Accepted
**Datum:** 2026-03-13

## Kontext

Der Prototyp nutzte den Supabase JS-Client direkt. Kein Schema-Tracking, keine Migrations, keine Type-Safety auf Query-Ebene. Schema-Änderungen wurden manuell im Supabase-Dashboard gemacht.

## Entscheidung

Drizzle ORM für alle DB-Operationen. Supabase bleibt als Auth-Provider, aber DB-Zugriff läuft über Drizzle mit direkter Postgres-Verbindung.

## Begründung

Type-safe Queries verhindern Runtime-Fehler. Generated Migrations sind reproduzierbar und reviewbar. Schema-as-Code ermöglicht PR-basierte DB-Änderungen. Drizzle hat minimalen Overhead (kein Query Builder wie Prisma).

## Konsequenzen

Supabase-RLS funktioniert weiterhin für Auth. RPC-Funktionen werden via `db.execute(sql`...`)` aufgerufen. Kein Vendor Lock-in auf Supabase für Daten.
