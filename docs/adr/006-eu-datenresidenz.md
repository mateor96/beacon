# ADR-006: EU-Datenresidenz

**Status:** Accepted
**Datum:** 2026-03-14

## Kontext

DSGVO erfordert dokumentierte Entscheidungen zur Datenverarbeitung und Drittlandübertragung. Der Prototyp lief auf Vercel ohne klar dokumentierte Datenresidenz-Strategie.

## Entscheidung

Alle primaeren Betriebsdaten werden in der EU gehostet. Produktivziel ist ein self-hosted Docker-Compose-Setup auf einem Hetzner CX22 VPS in Deutschland.

**Sub-Processor-Uebersicht:**

| Dienst | Standort | Zweck | Personenbezogene Daten |
|--------|----------|-------|------------------------|
| Hetzner (CX22) | DE | Hosting, Postgres, Redis, App-Server | Alle operationellen Daten |
| Hostinger VPS | EU | Fallback-Hosting | Gleicher Scope wie Hetzner |
| Supabase Auth | Frankfurt (eu-central-1) | Authentifizierung | E-Mail, Auth-Tokens |
| Claude API (Anthropic) | USA | KI-gestützte Analyse/Fixes | URL + HTML auf explizite Nutzeraktion |
| Stripe | USA (EU-Infrastruktur verfügbar) | Zahlungsabwicklung | E-Mail, Zahlungsdaten (Kartendaten tokenisiert via Stripe.js, nie auf Beacon-Servern) |
| Plausible | EU | Analytics | Keine PII (cookieless) |
| Sentry | EU (Frankfurt) | Error Tracking | Stack Traces, IP (anonymisiert) |

Geplante Drittlandübertragungen:

1. **Claude API (Anthropic):** URL und HTML werden nur auf explizite Nutzeraktion übertragen; personenbezogene Daten sollen nicht Bestandteil des Payloads sein.
2. **Stripe:** Zahlungsdaten werden über Stripe.js tokenisiert und auf US-Servern verarbeitet. Kartendaten beruehren nie Beacon-eigene Infrastruktur.

Rechtsgrundlage für beide Transfers: Art. 46 Abs. 2 lit. c DSGVO (Standardvertragsklauseln / SCCs via DPA des jeweiligen Anbieters).

## Begründung

EU-Datenresidenz ist für Beacon ein Produkt- und Vertrauensmerkmal. Ein self-hosted VPS in Deutschland reduziert Kosten gegenüber Vercel deutlich und vermeidet unnoetige US-Datenverarbeitung. Docker Compose haelt das Deployment portabel und vermeidet Vendor-Lock-in.

## Konsequenzen

- AVV mit Hetzner und Supabase abschliessen
- DPA/SCCs für Anthropic und Stripe prüfen und dokumentieren
- KI-Fix- und KI-Analyse-Flows müssen die Drittlandübertragung transparent machen
- Sentry und Plausible müssen auf EU-Regionen bleiben
- Ein Provider-Wechsel darf die EU-Residenz nicht aufheben
