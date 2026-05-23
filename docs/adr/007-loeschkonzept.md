# ADR-007: Löschkonzept (DSGVO Art. 17)

**Status:** Accepted
**Datum:** 2026-03-18

## Kontext

Das Recht auf Löschung nach Art. 17 DSGVO verlangt ein dokumentiertes Konzept für Account-Löschung, Datenaufbewahrung und technische Folgeschritte. Gleichzeitig müssen abrechnungsrelevante Daten und Audit-Nachweise nachvollziehbar bleiben.

## Entscheidung

### Löschstrategie: CASCADE + SET NULL

| Tabelle / Beziehung | Verhalten | Begründung |
|---------------------|-----------|-------------|
| `scans`, `site_crawls`, `monitoring_*`, `benchmark_groups`, `alerts`, `api_keys` | `CASCADE` | Operationelle Daten ohne eigenen Aufbewahrungszweck |
| `subscription_events.user_id` | `SET NULL` | Billing-Historie bleibt erhalten, Nutzerbezug wird gelöst |
| `audit_logs.user_id` | `SET NULL` | Audit-Trail bleibt erhalten, Nutzerbezug wird gelöst |
| `site_crawl_pages.scan_id` | `SET NULL` | TTL- oder manuelle Scan-Löschung darf Crawl-Pages nicht inkonsistent machen |

### Account-Löschung über `deleteUserAccount()`

Der kontrollierte Löschpfad läuft über `deleteUserAccount()` in einer einzigen DB-Transaktion:

1. Profil per `SELECT ... FOR UPDATE` sperren (Race Guard)
2. Stripe-Subscription innerhalb der TX kündigen (mit Timeout/AbortSignal)
3. Bei Stripe-Fehlern oder Timeout: TX rollback, Löschung abgebrochen
4. Scan-IDs für späteres File-Cleanup einsammeln
5. PII in `subscription_events.payload` redaktieren (`redactPiiFromPayload()`)
6. PII in `audit_logs.details` redaktieren (`redactPiiFromPayload()`)
7. `account_delete`-Audit-Log schreiben — ohne E-Mail, mit Cleanup-State und temporaerem `deletedUserId`
8. Profil löschen (CASCADE handles children, SET NULL preserves audit)
9. Auth-Cleanup außerhalb der TX mit Claim-Semantik
10. PDF-Reports löschen (soft-fail)

### PII-Redaktion

JSONB-Payloads in `subscription_events` und `audit_logs` werden vor der Profillöschung applikationsseitig redaktiert. Die Funktion `redactPiiFromPayload()` ersetzt rekursiv alle bekannten PII-Keys (`email`, `name`, `address`, `phone`, `line1`, `line2`, `city`, `state`, `postal_code`, `full_name`, `avatar_url`, `customer_email`, `customer_name`, `receipt_email`) durch `[REDACTED]`.

Das `account_delete`-Audit-Log selbst enthaelt keine E-Mail. Stattdessen wird ein minimaler Snapshot gespeichert:

```json
{
  "plan": "pro",
  "deletedAt": "2026-03-18T...",
  "deletedUserId": "uuid",
  "stripeCleanup": { "state": "done" },
  "authCleanup": { "state": "pending", "attempts": 0, "lastError": null, "claimedAt": null, "completedAt": null }
}
```

### Stripe-Cleanup State Machine

Die `stripeCleanup`-State-Machine kennt drei Zustaende:

| State | Bedingung |
|-------|-----------|
| `done` | `cancelStripeSubscription`-Callback vorhanden und erfolgreich |
| `pending` | `stripeSubscriptionId` existiert, aber kein Callback bereitgestellt |
| `skipped` | Kein `stripeSubscriptionId` vorhanden |

Bei `pending` wird die `stripeSubscriptionId` im Audit-Log-Details persistiert, damit ein Reconcile-Job sie später kündigen kann.

**Keine Claim-Semantik noetig:** Stripe-Subscription-Kündigung ist idempotent — das erneute Kündigen einer bereits gekuendigten Subscription ist ein No-Op in der Stripe API. Daher können parallele Reconcile-Worker beide sicher `cancel` aufrufen. Der `pending → done`-Uebergang via `markStripeCleanupDone()` ist state-guarded (`WHERE state = 'pending'`), sodass nur ein Writer den Uebergang markiert, aber doppelte Stripe-Calls harmlos sind. Dies ist einfacher als Auth-Cleanup, das Claim-Semantik braucht weil `deleteAuthUser` möglicherweise nicht idempotent ist.

Recovery-Queries:
- `getAccountDeletionsWithPendingStripeCleanup()` — liefert alle Rows mit `stripeCleanup.state = 'pending'`
- `markStripeCleanupDone(db, auditLogId)` — state-guarded Uebergang `pending → done`, entfernt `stripeSubscriptionId` aus Details

### Auth-Cleanup State Machine

`deletedUserId` bleibt temporaer im Audit-Log erhalten, damit Auth-Cleanup nach Profillöschung möglich ist. Die State Machine:

| Uebergang | Bedingung |
|-----------|-----------|
| `pending` -> `in_progress` | Atomarer Claim via `UPDATE ... WHERE state = 'pending'` |
| `in_progress` -> `done` | `deleteAuthUser()` erfolgreich; `deletedUserId` wird entfernt |
| `in_progress` -> `pending` | `deleteAuthUser()` fehlgeschlagen; `attempts` + `lastError` aktualisiert |
| `skipped` | Kein `deleteAuthUser`-Callback vorhanden |

Die Recovery-Query `getAccountDeletionsWithPendingCleanup()` liefert nur Rows mit `state = 'pending'`.

`deleteAuthUser()` behandelt "user not found" als Erfolg (Idempotenz).

### CAS-aware Result Reporting

`markAuthCleanupDone` und `markAuthCleanupFailed` verwenden `RETURNING id` und geben `boolean` zurück. Wenn der CAS-Guard (claimedAt-Check) fehlschlaegt (Lease gestohlen), wird der tatsächliche Zustand via `readAuthCleanupState()` nachgelesen und im Result zurückgegeben.

Gleiches gilt für den Claim-Miss: Wenn `claimAuthCleanup()` `null` zurückgibt (ein anderer Worker hat den Claim bereits), wird ebenfalls `readAuthCleanupState()` aufgerufen statt blind `"pending"` zurückzugeben.

`readAuthCleanupState()` gibt `AuthCleanupState` zurück. Bei fehlender Audit-Log-Row wird `AuditLogNotFoundError` geworfen, bei ungültigem oder fehlendem State-Wert `MalformedAuthCleanupStateError` — beides sind Datenintegritätsprobleme, keine wiederholbaren Cleanups. Ein stiller Fallback auf `"pending"` würde eine Row erzeugen, die vom Caller als retryable gemeldet wird, aber von `getAccountDeletionsWithPendingCleanup()` nie gefunden werden kann. Der Rückgabetyp von `DeleteAccountResult.authCleanupState` bleibt `AuthCleanupState` (keine API-Shape-Änderung).

### Retention / TTL

Aktuell ist planbasierte TTL für `scans` über `expires_at` und Cleanup-Queries umgesetzt. Weitere TTLs für `anonymous_scans`, `monitoring_results` und HTML-Rohinhalte bleiben ein geplanter Ausbau.

## Begründung

`CASCADE` ist für operationelle Daten der robusteste Standardpfad. `SET NULL` für Audit- und Billing-Beziehungen erlaubt Löschung des Accounts, ohne abrechnungs- oder compliance-relevante Zeilen unkontrolliert zu verlieren. Die Aufbewahrung von `subscription_events` ist zusätzlich durch Art. 17 Abs. 3 lit. b DSGVO (gesetzliche Aufbewahrungspflicht) gedeckt: HGB §257 verlangt eine 6- bis 10-jährige Aufbewahrung von Buchungsbelegen.

Stripe-Cancel innerhalb der TX mit `FOR UPDATE` verhindert Race Conditions bei konkurrierenden Delete-Requests. Der Tradeoff (kurzer Row-Lock während Stripe-Call) ist für Account-Löschung akzeptabel. Ein AbortSignal mit Timeout verhindert unbegrenzt offene Transaktionen.

PII-Redaktion auf Applikationsebene (statt DB-seitiger JSONB-Funktion) ist pragmatisch und ausreichend, da die Redaktion innerhalb derselben TX wie die Profillöschung stattfindet.

Das Re-Read-Pattern bei CAS-Misses und Claim-Misses stellt sicher, dass keine falsch-positiven Statusmeldungen zurückgegeben werden. Stripe-Cleanup braucht keine Claim-Semantik weil die Stripe API idempotente Kündigungen unterstützt. Auth-Cleanup braucht Claim-Semantik weil `deleteAuthUser` möglicherweise nicht idempotent ist (z.B. Supabase Admin API).

## Konsequenzen

- Höhere Ebenen sollen `deleteUserAccount()` statt generischer Profil-Löschung verwenden
- PII in JSONB-Payloads wird vor Profillöschung redaktiert
- `deletedUserId` im Audit-Log ist temporaer und wird nach erfolgreichem Auth-Cleanup entfernt
- Ein späterer Reconcile-Job kann `getAccountDeletionsWithPendingCleanup()` für Auth und `getAccountDeletionsWithPendingStripeCleanup()` für Stripe nutzen
- `DeleteAccountResult.authCleanupState` bleibt `AuthCleanupState` (keine API-Shape-Änderung für Caller)
- `DeleteAccountResult.stripeCleanupState` zeigt ob ein Reconcile-Job noetig ist
- `readAuthCleanupState()` wirft `AuditLogNotFoundError` bei fehlender Row (Datenintegritätsproblem)
- Zusätzliche TTL-Regeln außerhalb von `scans` sind noch umzusetzen
