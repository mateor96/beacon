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
3. Grant access, then paste an Beacon API token with scope `looker:read`.
4. Tokens are generated in Beacon under **Einstellungen → Integrationen → Looker Studio** (#215).

## Field reference

The connector exposes the fields defined in `packages/api-sdk/src/looker/schema.ts`. Default-on fields: `domain`, `scan_date`, `readiness_score`, `citation_count`.

Keep this .gs file in sync with the schema module — any field-id change requires a re-push here.
