/**
 * Beacon Looker Studio Community Connector (#208).
 *
 * Three Looker-mandatory functions: getAuthType, getSchema, getData.
 * Plus isAdminUser. All Beacon data is fetched from the backend endpoint
 * built in #201: GET /api/v1/integrations/looker/data.
 *
 * Deploy via `clasp push` — see README.md. The script expects one
 * property set at deploy time:
 *   BEACON_BASE_URL  — e.g. "https://beacon.your-domain.com"
 */

var BEACON_DEFAULT_BASE_URL = "https://beacon.example.com";

function getAwrBaseUrl() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty("BEACON_BASE_URL") || BEACON_DEFAULT_BASE_URL;
}

// ── Auth ──────────────────────────────────────────────────

function getAuthType() {
  var cc = DataStudioApp.createCommunityConnector();
  return cc.newAuthTypeResponse().setAuthType(cc.AuthType.KEY).build();
}

function setCredentials(request) {
  // BEACON_API_TOKEN is operator-generated (openssl rand -hex 32). We
  // accept any non-empty token >= 32 chars; the backend timing-safe
  // compares against the env value.
  var token = (request.key || "").trim();
  if (token.length < 32) {
    return { errorCode: "INVALID_CREDENTIALS" };
  }
  PropertiesService.getUserProperties().setProperty("dscc.key", token);
  return { errorCode: "NONE" };
}

function resetAuth() {
  PropertiesService.getUserProperties().deleteProperty("dscc.key");
}

function isAuthValid() {
  var token = PropertiesService.getUserProperties().getProperty("dscc.key");
  return !!token && token.length >= 32;
}

function isAdminUser() {
  return false;
}

// ── Schema ────────────────────────────────────────────────

/**
 * Field definitions mirror packages/api-sdk/src/looker/schema.ts
 * (#193). Keep in sync — the backend endpoint validates the
 * same field ids.
 */
var BEACON_FIELDS = [
  { id: "scan_id",          label: "Scan ID",            kind: "dim", type: "STRING", defaultOn: false },
  { id: "domain",           label: "Domain",             kind: "dim", type: "STRING", defaultOn: true },
  { id: "scan_date",        label: "Scan Date",          kind: "dim", type: "DATE",   defaultOn: true },
  { id: "locale_country",   label: "Locale Country",     kind: "dim", type: "STRING", defaultOn: false },
  { id: "locale_language",  label: "Locale Language",    kind: "dim", type: "STRING", defaultOn: false },
  { id: "competitor_domain",label: "Competitor Domain",  kind: "dim", type: "STRING", defaultOn: false },
  { id: "status",           label: "Scan Status",        kind: "dim", type: "STRING", defaultOn: false },

  { id: "readiness_score",  label: "AI Readiness Score", kind: "met", type: "NUMBER", agg: "AVG",   defaultOn: true },
  { id: "readiness_level",  label: "Readiness Level",    kind: "met", type: "NUMBER", agg: "AVG",   defaultOn: false },
  { id: "citation_count",   label: "Citation Count",     kind: "met", type: "NUMBER", agg: "SUM",   defaultOn: true },
  { id: "fix_count",        label: "Fix Count",          kind: "met", type: "NUMBER", agg: "SUM",   defaultOn: false },
  { id: "competitor_count", label: "Competitor Count",   kind: "met", type: "NUMBER", agg: "COUNT", defaultOn: false },
  { id: "locale_count",     label: "Locale Count",       kind: "met", type: "NUMBER", agg: "COUNT", defaultOn: false }
];

function buildField(cc, fields, f) {
  var field;
  if (f.kind === "dim") {
    field = fields.newDimension().setId(f.id).setName(f.label);
  } else {
    field = fields.newMetric().setId(f.id).setName(f.label);
    if (f.agg) field.setAggregation(cc.AggregationType[f.agg]);
  }
  field.setType(cc.FieldType[f.type]);
  if (f.defaultOn) field.setIsDefault(true);
  return field;
}

function getFields() {
  var cc = DataStudioApp.createCommunityConnector();
  var fields = cc.getFields();
  for (var i = 0; i < BEACON_FIELDS.length; i++) {
    buildField(cc, fields, BEACON_FIELDS[i]);
  }
  return fields;
}

function getSchema(_request) {
  return { schema: getFields().build() };
}

// ── Data fetch ─────────────────────────────────────────────

function getData(request) {
  var requestedIds = (request.fields || []).map(function (f) { return f.name; });
  var token = PropertiesService.getUserProperties().getProperty("dscc.key");
  if (!token) {
    throw new Error("Kein API-Token hinterlegt. Bitte neu verbinden.");
  }

  var allRows = [];
  var cursor = null;
  var pageSize = 1000;
  var safety = 50; // max 50k rows

  do {
    var url = getAwrBaseUrl() + "/api/v1/integrations/looker/data" +
              "?fields=" + encodeURIComponent(requestedIds.join(","));
    if (cursor) url += "&cursor=" + encodeURIComponent(cursor);
    url += "&pageSize=" + pageSize;
    if (request.dateRange) {
      if (request.dateRange.startDate) {
        url += "&from=" + encodeURIComponent(request.dateRange.startDate);
      }
      if (request.dateRange.endDate) {
        url += "&to=" + encodeURIComponent(request.dateRange.endDate);
      }
    }

    var response = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    if (code === 401 || code === 403) {
      throw new Error("Token abgelehnt (HTTP " + code + "). Bitte Token in Beacon neu generieren.");
    }
    if (code >= 400) {
      throw new Error("Beacon API Fehler: HTTP " + code + " — " + response.getContentText().substr(0, 200));
    }

    var body = JSON.parse(response.getContentText());
    allRows = allRows.concat(body.rows || []);
    cursor = body.meta && body.meta.hasMore ? body.meta.nextCursor : null;
    safety--;
  } while (cursor && safety > 0);

  // Build the schema projection that matches the requested field order.
  var fields = getFields();
  var filtered = fields.forIds(requestedIds).build();

  return { schema: filtered, rows: allRows, cachedData: false };
}
