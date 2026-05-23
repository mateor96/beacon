# ADR-009: Report-Artefakt-Vertrag (Speicher, Download, Retention)

**Status:** Accepted
**Datum:** 2026-03-16
**Issue:** #152
**Betroffene Pakete:** `apps/worker`, `apps/web`, `packages/db`, `packages/auth`

---

## Kontext

Der Report-Worker (`apps/worker/src/processors/report.processor.ts`) generiert PDF-Berichte via Puppeteer und schreibt sie auf das lokale Dateisystem unter `REPORT_STORAGE_PATH` (Default: `/tmp/reports`). Der Dateiname folgt dem Schema `{scanId}.pdf`.

Aktueller Stand:

- **Kein DB-Metadatensatz** für generierte Report-Artefakte — lediglich `reportTexts` (JSONB) auf der `scans`-Tabelle
- **Kein Download-Endpoint** — `/api/report` ist in `PROTECTED_PREFIXES` registriert (Zeile 52, `packages/auth/src/routes.ts`), aber kein Handler existiert
- **`reportUrl`-Semantik ist irreführend** — der Worker gibt `/reports/{scanId}.pdf` zurück, was eine oeffentliche URL impliziert. Es gibt aber kein Static-File-Serving für diesen Pfad. #153 muss diese Semantik korrigieren.
- **Scan-Ownership** via `scans.userId` (FK auf `profiles.id`, nullable für anonyme Scans)
- **Retention** via `scans.expiresAt` (plan-basiert: 30–730 Tage), gesteuert durch `deleteExpiredScans()` in `packages/db/src/queries/cleanup.ts`
- **Cleanup löscht nur DB-Rows** — PDF-Dateien auf dem Filesystem werden nicht mitgelöscht

Diese ADR friert den MVP-Vertrag ein, damit #153 ohne Architektur-Guesswork implementieren kann.

---

## Entscheidungen

### 1. Storage: Lokales Dateisystem via `REPORT_STORAGE_PATH`

PDF-Artefakte werden auf dem lokalen Dateisystem gespeichert. Produktiv zeigen Web- und Worker-Container auf dasselbe gemountete Volume. Dateiname: `{scanId}.pdf`.

**Begründung:** Hetzner/Hostinger VPS mit Docker Compose — kein externer Object-Store noetig für MVP. PDFs sind aus Scan-Daten jederzeit regenerierbar; Datenverlust bei Volume-Problemen ist akzeptabel.

**Konsequenz:** Bei horizontalem Worker-Scaling entsteht ein Sync-Problem. Für MVP (Single-Node) kein Problem.

### 2. Zugriff: Geschuetzter Download, niemals oeffentlich

PDF-Reports sind ausschließlich über einen authentifizierten API-Endpoint downloadbar. Das `REPORT_STORAGE_PATH`-Verzeichnis darf nie als Static-File-Serving exponiert werden. Keine rohen Dateisystempfade zum Client leaken.

### 3. Endpoint: `GET /api/report/[id]`

Der Download-Endpoint liegt unter `GET /api/report/[id]`. Dies nutzt den bereits als protected registrierten `/api/report`-Prefix in `packages/auth/src/routes.ts:48`.

### 4. Ownership: Nur Scan-Eigentuemer

Download nur möglich wenn `scan.userId === session.user.id`. Anonyme Scans (`userId IS NULL`) erhalten im MVP keinen downloadbaren PDF-Report. Der PDF-Download ist ein Paid-Feature hinter Registration Wall.

### 5. Plan-Gate: `canExportPdf(plan)`

Nutzer auf dem Free-Plan erhalten keinen PDF-Download. Plan-Pruefung über die bestehende `canExportPdf(plan)`-Funktion aus `@beacon/billing`.

### 6. Kardinalität: Ein PDF pro Scan, Overwrite bei Regenerierung

Genau ein PDF-Artefakt pro Scan. Regenerierung überschreibt die bestehende Datei. Keine Versionierung.

### 7. Metadaten: Minimale Spalten auf `scans`

Keine separate Tabelle. Zwei neue nullable Spalten auf `scans`:

| Spalte | Typ | Beschreibung |
|---|---|---|
| `reportGeneratedAt` | `timestamp with time zone` | Zeitpunkt der letzten PDF-Generierung. `NULL` = kein PDF vorhanden. |
| `reportFileSizeBytes` | `integer` | Dateigroesse in Bytes. Für UI-Anzeige und Monitoring. |

**Nicht gespeichert:** Absoluter Dateipfad (wird zur Laufzeit aus `REPORT_STORAGE_PATH + scanId + ".pdf"` abgeleitet), Branding-Parameter, Report-Version.

`reportGeneratedAt IS NOT NULL` ist das kanonische Signal, dass ein PDF existiert.

### 8. Pfad-Ableitung

Kein absoluter Pfad in der DB. Der Dateipfad wird deterministisch abgeleitet:

```
path.join(REPORT_STORAGE_PATH, `${scanId}.pdf`)
```

### 9. Retention: Folgt `scan.expiresAt`

PDF-Lebensdauer ist identisch mit dem Scan-Record. Wenn `deleteExpiredScans()` den DB-Record löscht, muss die korrespondierende PDF-Datei ebenfalls gelöscht werden.

### 10. Cleanup-Vertrag

Löschung muss idempotent sein: wenn die Datei fehlt (nie generiert oder bereits gelöscht), wird `ENOENT` still verschluckt. Der exakte Scheduler/Mechanismus (BullMQ repeatable Job, Cron, etc.) gehört zu #153, nicht zu diesem Vertrag.

```typescript
// Pseudocode — konkreter Mechanismus ist #153-Scope
for (const { id } of deletedScanIds) {
  await unlink(path.join(REPORT_STORAGE_PATH, `${id}.pdf`)).catch(() => {});
}
```

### 11. Account-Löschung

Report-Dateien für gelöschte Nutzer müssen ebenfalls entfernt werden. Die DB-seitige CASCADE-Löschung (`scans.userId ON DELETE CASCADE`) entfernt die Rows, aber nicht die Dateien. Die Implementierung gehört zu #153 oder einem eigenen Issue.

### 12. Response-Vertrag

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="beacon-report-{scanId}.pdf"
Cache-Control: private, max-age=3600
X-Content-Type-Options: nosniff
```

### 13. Error-Vertrag

| HTTP | Bedeutung | Wann |
|---|---|---|
| 401 | Nicht authentifiziert | Keine gueltige Session |
| 400 | Ungültige Scan-ID | UUID-Validierung fehlgeschlagen |
| 403 | Plan blockiert | `canExportPdf(plan)` ist false |
| 404 | Nicht gefunden | Scan existiert nicht, gehört anderem User, oder PDF nie generiert |
| 409 | Scan nicht bereit | `scan.status !== "completed"` |
| 410 | Abgelaufen | `scan.expiresAt < now` |

Ownership-Fehler werden als 404 maskiert (kein Scan-Enumeration-Leak).

### 14. Sicherheit

- UUID-Validierung vor jeder Pfad-Konstruktion (verhindert Path Traversal)
- Keine Dateisystempfade in Responses leaken
- `Content-Disposition: attachment` erzwingt Download statt Inline-Rendering

---

## `reportUrl`-Semantik: Entscheidung

Das Feld `reportUrl` wird aus dem Worker-/Queue-Result entfernt. Der Worker erzeugt das PDF-Artefakt und liefert nur den fachlichen Erfolg für den Scan zurück; web-oeffentliche oder API-interne Download-Pfade werden nicht im Job-Result kodiert.

**Begründung:** Der Download-Pfad ist bereits deterministisch und geschuetzt (`GET /api/report/[id]`). Die Web-/API-Schicht kann ihn aus `scanId` ableiten. So bleibt der Worker frei von Web-Routing-Semantik und impliziert keine oeffentliche `/reports/*`-URL.

**#153 setzt dies um:** `packages/queue/src/types.ts`, `apps/worker/src/processors/report.processor.ts` und zugehörige Tests werden angepasst. Diese ADR bleibt docs-only und definiert nur den Vertrag.

---

## Out-of-Scope

| Thema | Begründung |
|---|---|
| S3 / Object-Storage | Single-VPS, kein Multi-Node |
| Signed URLs | Kein Object-Storage-Backend |
| Oeffentliches Sharing | Separates Auth-Modell + DSGVO-Oberflaeche |
| Report-Versionierung | 1:1 Scan-zu-PDF für MVP |
| Multi-Format-Export | Nur PDF |
| Dashboard/UI | Separates Issue (#153) |
| BullMQ-Scheduler-Details | Cron-Pattern, Intervall etc. gehört zu #153 |
| Generische Storage-Abstraktion | Ein Backend, kein Interface noetig |

---

## Referenzen

- `apps/worker/src/processors/report.processor.ts` — PDF-Generierung und Filesystem-Write
- `packages/db/src/schema/scans.ts` — Scan-Tabelle mit `expiresAt`, `userId`, `reportTexts`
- `packages/db/src/queries/cleanup.ts` — `deleteExpiredScans()`, `setExpiresAtForScans()`
- `packages/auth/src/routes.ts:48` — `/api/report` in `PROTECTED_PREFIXES`
- Issue #152 — Vertragsdefinition (dieses Dokument)
- Issue #153 — Implementierung
