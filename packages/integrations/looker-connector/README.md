# Beacon Looker Studio Community Connector

Google Apps Script implementing a Looker Studio Community Connector that exposes Beacon scan data (scores, citations, locales, competitors) to Looker Studio dashboards.

Backend endpoint: `GET /api/v1/integrations/looker/data` (see issue #201).

## Deployment (for agency admins)

### 1. Install clasp

```bash
npm install -g @google/clasp
clasp login
```

### 2. Create the Apps Script project

```bash
clasp create --type standalone --title "Beacon Looker Connector"
```

This writes `.clasp.json` with your new script id.

### 3. Set the Beacon backend URL

In [script.google.com](https://script.google.com), open your script, go to **Project Settings → Script Properties**, and add:

- Property: `BEACON_BASE_URL`
- Value: `https://your-beacon-instance.com`

### 4. Push the code

```bash
cp .clasp.json.example .clasp.json  # edit scriptId
clasp push
```

### 5. Deploy as a Looker Studio connector

1. In the Apps Script editor, open **Deploy → New deployment**.
2. Deployment type: **Looker Studio Connector**.
3. Configure description + logo, then deploy.
4. Copy the deployment URL.

### 6. Use in Looker Studio

1. Open [lookerstudio.google.com/datasources/create](https://lookerstudio.google.com/datasources/create).
2. Select the community connector URL from step 5.
3. Grant access, then paste the instance API token.

### 7. Generating the instance API token

In v0.2, Beacon runs single-tenant and uses one instance-wide token configured
via the `BEACON_API_TOKEN` env var. Generate one with:

```bash
openssl rand -hex 32
```

Put it in `.env`:

```
BEACON_API_TOKEN=<the value you just generated>
```

Restart the web container. The current token is displayed at
`https://<your-beacon-instance>/admin/api-token` for easy copy/paste.

## Field reference

The connector exposes the fields defined in `Code.gs:BEACON_FIELDS`:

| Field id | Looker type | Source |
|---|---|---|
| `scan_id` | DIMENSION (STRING) | `scans.id` |
| `domain` | DIMENSION (STRING) | hostname of `scans.final_url` (fallback `scans.url`) |
| `scan_date` | DIMENSION (DATE) | `scans.scanned_at` (YYYYMMDD) |
| `status` | DIMENSION (STRING) | `scans.status` |
| `readiness_score` | METRIC (NUMBER, AVG) | `scans.score` |
| `readiness_level` | METRIC (NUMBER, AVG) | `scans.readiness_level` |
| `fix_count` | METRIC (NUMBER, SUM) | `Object.keys(scans.fixes).length` |
| `citation_count`, `competitor_count`, `locale_count` | METRIC (NUMBER) | computed as 0 in v0.2 — wiring follows in #10 (crawl), #4 (monitoring), and competitors |
| `locale_country`, `locale_language`, `competitor_domain` | DIMENSION (STRING) | null in v0.2 (joins not yet wired) |

Keep this `Code.gs` in sync with the route at `apps/web/src/app/api/v1/integrations/looker/data/route.ts`.
