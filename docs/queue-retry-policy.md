# Queue Retry Policy

## Übersicht

Jede BullMQ-Queue hat eine konfigurierte Retry-Policy. Nach Erschöpfung aller Versuche
wird der Job in die `dead_letter_jobs`-Tabelle geschrieben.

## Policy pro Queue

| Queue | Attempts | Backoff | Concurrency | Rate Limit | Begründung |
|-------|----------|---------|-------------|------------|------------|
| Queue | Attempts | Backoff | Concurrency | Rate Limit | Lock Duration | Begründung |
|-------|----------|---------|-------------|------------|---------------|------------|
| scan | 3 | 2 s exponential | 5 | — | 30 s (default) | HTTP-Fetches sind flaky, günstig zu wiederholen |
| fix | 2 | 5 s exponential | 3 | 10/min | 60 s | Claude API kostet Geld, Rate-Limit-aware |
| report | 2 | 5 s exponential | 2 | — | 120 s | Speicherintensives PDF, Puppeteer braucht Zeit |
| analysis | 2 | 5 s exponential | 3 | 10/min | 60 s | Gleiche Claude API Kostenlogik wie fix |

## Design-Prinzipien

- **Kosten:** Queues die externe APIs aufrufen (Claude) haben weniger Retries
- **Backoff:** Exponentielles Backoff verhindert Thundering Herd
- **Concurrency:** Je teurer/schwerer der Job, desto geringer die Parallelität
- **Retention:** Erfolgreiche Jobs: 1h, fehlgeschlagene Jobs: 24h (BullMQ), DLQ: 30 Tage (empfohlen)

## Dead Letter Queue (DLQ)

Nach Erschöpfung aller Retries:

1. **DB-Eintrag:** Job wird in `dead_letter_jobs` gespeichert (Queue, JobData, Error, Stack)
2. **Structured Alert:** Bei Überschreitung des Schwellwerts (5 Fehler in 10 Min) wird ein
   JSON-Alert auf stderr ausgegeben (`level: "alert"`, `type: "terminal_failure_threshold"`)
3. **Dedup:** `UNIQUE(queue, jobId)` verhindert doppelte Einträge

### Tabelle `dead_letter_jobs`

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | UUID | Primary Key |
| queue | TEXT | Queue-Name |
| job_id | TEXT | BullMQ Job-ID |
| job_data | JSONB | Originale Job-Daten |
| error_message | TEXT | Fehlermeldung |
| error_stack | TEXT | Stack-Trace (optional) |
| attempts_made | INTEGER | Durchgeführte Versuche |
| max_attempts | INTEGER | Maximale Versuche |
| failed_at | TIMESTAMPTZ | Zeitpunkt des finalen Fehlers |

### Retention

- Empfohlene Retention: **30 Tage**
- Cleanup-Helfer: `deadLetterJobQueries.deleteOlderThan(db, cutoff)`
- **TODO:** Scheduled Cleanup ist noch nicht verdrahtet — muss als Repeatable Job oder Cron eingerichtet werden

## Threshold-Alert

- **In-Memory Sliding-Window** pro Queue
- **Schwellwert:** 5 Fehler in 10 Minuten (konfigurierbar via ENV)
- **Cooldown:** 10 Minuten zwischen Alerts
- **Output:** Structured JSON auf stderr

Konfiguration via Umgebungsvariablen:
- `ALERT_FAILURE_THRESHOLD` (default: 5)
- `ALERT_FAILURE_WINDOW_MS` (default: 600000)
- `ALERT_FAILURE_COOLDOWN_MS` (default: 600000)

## Shutdown-Sicherheit

Der Worker fährt in 3 Phasen herunter:

1. **Phase 1 — Drain:** `worker.close()` wartet auf laufende Jobs (Timeout: `WORKER_SHUTDOWN_TIMEOUT_MS`, default 25s)
2. **Phase 2 — DLQ-Writes:** Alle ausstehenden DLQ-Schreibvorgänge werden abgewartet (Timeout: 5s)
3. **Phase 3 — Cleanup:** Queue-Verbindungen und HTTP-Server werden geschlossen

**Sicherheitsnetze:**
- Doppeltes SIGTERM → sofortiger `process.exit(1)`
- Force-Exit-Timer (`shutdownTimeoutMs + 5s`) verhindert ewiges Hängen
- Docker `stop_grace_period: 30s` gibt dem Prozess genug Zeit vor SIGKILL

**DLQ-Persistenz-Vertrag:**
- DLQ-Writes werden via `PromiseTracker` getrackt (nicht fire-and-forget)
- Bei DB-Fehler: 2 Retries mit 2s Delay
- Bei totalem DB-Ausfall: Structured JSON auf stderr als Fallback (`type: "dlq_persistence_failure"`)
- Shutdown wartet auf alle getrackten Writes bevor der Prozess beendet wird

## Eskalation (MVP-Scope)

Der aktuelle Eskalationsmechanismus ist bewusst als MVP begrenzt:

- **In-Memory Sliding-Window** pro Queue (resets bei Worker-Neustart)
- Bei Schwellwert-Überschreitung: Structured JSON auf stderr
- **Bewusst deferred:** DB-backed Escalation, Webhooks, `escalation_events`-Tabelle
- Für Single-Instance-Deployments ist der In-Memory-Ansatz ausreichend

## Wann die Policy ändern?

- Bei neuen Queues: Retry-Kosten und Seiteneffekte abwägen
- Bei Kostensteigerung: Attempts reduzieren oder Rate Limits verschärfen
- Bei häufigen DLQ-Einträgen: Root Cause analysieren, nicht einfach Retries erhöhen
