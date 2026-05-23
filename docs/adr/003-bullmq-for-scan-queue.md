# ADR-003: BullMQ für Scan-Queue

**Status:** Accepted
**Datum:** 2026-03-13

## Kontext

Der Prototyp führte alle 10 Scanner-Checks synchron in einer Serverless-Function aus (~5-15s). Bei hoher Last: Timeouts, Connection-Pool-Exhaustion, keine Retry-Logik.

## Entscheidung

BullMQ als Job-Queue mit Redis als Backend. Scans, Fixes, Reports und Analysen werden async verarbeitet.

## Begründung

BullMQ ist battle-tested für Node.js, unterstützt Retries, Dead Letter Queues, Concurrency-Limits, Repeatable Jobs und Priority Queues. Redis ist ohnehin für Rate-Limiting nötig. Kein zusätzlicher Service.

## Konsequenzen

API gibt sofort 202 Accepted zurück. Frontend muss pollen oder WebSocket nutzen. Worker-Prozess braucht eigenen Docker-Container. Komplexität steigt, aber Skalierbarkeit und Zuverlässigkeit steigen drastisch.
