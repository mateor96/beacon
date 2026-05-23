/**
 * OpenAPI 3.1 specification for the Beacon API.
 *
 * Maintained as a TypeScript object for type safety.
 * Served at /api/openapi.json and consumed by Scalar docs at /docs/api.
 */

const ErrorSchema = {
	type: "object" as const,
	properties: {
		error: { type: "string" as const, description: "Fehlermeldung" },
	},
	required: ["error"],
};

const ErrorWithUpgradeSchema = {
	type: "object" as const,
	properties: {
		error: { type: "string" as const, description: "Fehlermeldung" },
		upgradeTo: {
			type: "string" as const,
			nullable: true,
			description: "Empfohlener Plan für ein Upgrade",
		},
	},
	required: ["error"],
};

const UuidParam = (name: string, description: string) => ({
	name,
	in: "path" as const,
	required: true,
	schema: { type: "string" as const, format: "uuid" },
	description,
});

const ProjectIdQuery = {
	name: "projectId",
	in: "query" as const,
	required: true,
	schema: { type: "string" as const, format: "uuid" },
	description: "Projekt-ID",
};

export const openApiSpec = {
	openapi: "3.1.0",
	info: {
		title: "Beacon API",
		version: "1.0.0",
		description:
			"Die Beacon API ermöglicht die Steuerung von AI-Readiness-Scans, Fix-Generierung, Report-Erstellung, ROI-Analysen, AI-Visibility-Monitoring und One-Click-Deployments. Alle authentifizierten Endpunkte erfordern einen Bearer-Token (JWT).",
	},
	servers: [{ url: "/api/v1", description: "Beacon API v1" }],
	tags: [
		{ name: "Oeffentlich", description: "Endpunkte ohne Authentifizierung" },
		{ name: "Scan", description: "AI-Readiness-Scans erstellen und abfragen" },
		{ name: "Fix", description: "Fix-Generierung für erkannte Probleme" },
		{ name: "Report", description: "PDF-Report-Erstellung und -Download" },
		{ name: "ROI", description: "ROI-Report-Erstellung und -Historie" },
		{ name: "Monitoring", description: "AI-Visibility-Monitoring-Daten abfragen" },
		{ name: "Deployment", description: "One-Click-Deployment und Rollback" },
	],
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
			},
		},
		schemas: {
			Error: ErrorSchema,
			ErrorWithUpgrade: ErrorWithUpgradeSchema,
			HealthResponse: {
				type: "object",
				properties: {
					status: {
						type: "string",
						enum: ["ready", "degraded"],
						description: "Systemstatus",
					},
					service: { type: "string", example: "web" },
					checks: {
						type: "object",
						properties: {
							db: { type: "boolean" },
							redis: { type: "boolean" },
						},
					},
					timestamp: {
						type: "string",
						format: "date-time",
						example: "2025-06-15T10:30:00.000Z",
					},
				},
				required: ["status", "service", "checks", "timestamp"],
			},
			PublicAuditRequest: {
				type: "object",
				properties: {
					url: {
						type: "string",
						format: "uri",
						example: "https://example.com",
						description: "Die zu prüfende URL",
					},
				},
				required: ["url"],
			},
			PublicAuditResponse: {
				type: "object",
				properties: {
					jobId: {
						type: "string",
						format: "uuid",
						example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
					},
					status: { type: "string", enum: ["pending"], example: "pending" },
				},
				required: ["jobId", "status"],
			},
			PublicAuditStatusResponse: {
				type: "object",
				properties: {
					jobId: { type: "string", format: "uuid" },
					status: {
						type: "string",
						enum: ["pending", "processing", "completed", "failed"],
					},
					url: { type: "string", format: "uri" },
					createdAt: { type: "string", format: "date-time" },
					result: {
						type: "object",
						nullable: true,
						properties: {
							overallScore: { type: "number", example: 72 },
							modelScores: { type: "object" },
							summary: { type: "string" },
						},
					},
				},
				required: ["jobId", "status", "url", "createdAt"],
			},
			ScanRequest: {
				type: "object",
				properties: {
					url: {
						type: "string",
						format: "uri",
						example: "https://example.com",
						description: "Die zu scannende URL",
					},
				},
				required: ["url"],
			},
			ScanCreateResponse: {
				type: "object",
				properties: {
					scanId: {
						type: "string",
						format: "uuid",
						example: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
					},
					status: { type: "string", enum: ["pending"], example: "pending" },
					resultsUrl: {
						type: "string",
						example: "/results/b2c3d4e5-f6a7-8901-bcde-f12345678901",
					},
				},
				required: ["scanId", "status", "resultsUrl"],
			},
			ScanResult: {
				type: "object",
				description:
					"Serialisiertes Scan-Ergebnis. Die genaue Struktur hängt vom Zugangsmodus ab (owner vs. access-token).",
				properties: {
					id: { type: "string", format: "uuid" },
					url: { type: "string", format: "uri" },
					status: {
						type: "string",
						enum: ["pending", "processing", "completed", "failed"],
					},
					score: { type: "number", example: 85 },
					readinessLevel: { type: "number", example: 3 },
					checks: { type: "array", items: { type: "object" } },
					createdAt: { type: "string", format: "date-time" },
				},
				required: ["id", "url", "status"],
			},
			FixStatusResponse: {
				type: "object",
				properties: {
					scanId: { type: "string", format: "uuid" },
					url: { type: "string", format: "uri" },
					fixStatuses: {
						type: "object",
						nullable: true,
						additionalProperties: {
							type: "object",
							properties: {
								status: { type: "string" },
								error: { type: "string", nullable: true },
								startedAt: { type: "string", format: "date-time", nullable: true },
								completedAt: {
									type: "string",
									format: "date-time",
									nullable: true,
								},
							},
							required: ["status"],
						},
						description: "Status pro Check-ID",
					},
				},
				required: ["scanId", "url", "fixStatuses"],
			},
			AnalysisStatusResponse: {
				type: "object",
				properties: {
					scanId: { type: "string", format: "uuid" },
					url: { type: "string", format: "uri" },
					status: {
						type: "string",
						enum: ["pending", "processing", "complete", "failed"],
					},
					semantic: {
						type: "object",
						nullable: true,
						properties: {
							status: { type: "string" },
							data: { type: "object", nullable: true },
							error: { type: "string", nullable: true },
						},
						required: ["status"],
					},
					citation: {
						type: "object",
						nullable: true,
						properties: {
							status: { type: "string" },
							data: { type: "object", nullable: true },
							error: { type: "string", nullable: true },
						},
						required: ["status"],
					},
				},
				required: ["scanId", "url", "status"],
			},
			ReportStatusResponse: {
				type: "object",
				properties: {
					scanId: { type: "string", format: "uuid" },
					url: { type: "string", format: "uri" },
					status: { type: "string", nullable: true },
					error: { type: "string", nullable: true },
					generatedAt: {
						type: "string",
						format: "date-time",
						nullable: true,
					},
					fileSizeBytes: { type: "integer", nullable: true },
				},
				required: ["scanId", "url", "status"],
			},
			FixRequest: {
				type: "object",
				properties: {
					scanId: {
						type: "string",
						format: "uuid",
						description: "ID des abgeschlossenen Scans",
					},
					checkId: {
						type: "string",
						description: "ID des Checks, für den ein Fix generiert werden soll",
						example: "meta-description",
					},
				},
				required: ["scanId", "checkId"],
			},
			FixResponse: {
				type: "object",
				properties: {
					scanId: { type: "string", format: "uuid" },
					checkId: { type: "string" },
					status: {
						type: "string",
						enum: ["processing", "completed"],
					},
					fix: {
						type: "object",
						nullable: true,
						properties: {
							checkId: { type: "string" },
							content: { type: "string" },
							filename: { type: "string" },
							method: { type: "string" },
						},
					},
				},
				required: ["scanId", "checkId", "status"],
			},
			AnalyzeRequest: {
				type: "object",
				properties: {
					scanId: {
						type: "string",
						format: "uuid",
						description: "ID des abgeschlossenen Scans",
					},
					type: {
						type: "string",
						enum: ["semantic", "citation", "both"],
						description: "Art der KI-Analyse",
						example: "both",
					},
				},
				required: ["scanId", "type"],
			},
			AnalyzeResponse: {
				type: "object",
				properties: {
					scanId: { type: "string", format: "uuid" },
					status: {
						type: "string",
						enum: ["processing", "completed"],
					},
					types: {
						type: "array",
						items: { type: "string", enum: ["semantic", "citation"] },
					},
					message: { type: "string", nullable: true },
				},
				required: ["scanId", "status"],
			},
			ReportRequest: {
				type: "object",
				properties: {
					scanId: {
						type: "string",
						format: "uuid",
						description: "ID des abgeschlossenen Scans",
					},
					branding: {
						type: "object",
						nullable: true,
						description: "Optionales Custom-Branding (Agency-Plan)",
						properties: {
							agencyName: { type: "string" },
							primaryColor: { type: "string", example: "#1a1a2e" },
							accentColor: { type: "string", example: "#e94560" },
							logoUrl: { type: "string", format: "uri", nullable: true },
						},
					},
				},
				required: ["scanId"],
			},
			ReportCreateResponse: {
				type: "object",
				properties: {
					scanId: { type: "string", format: "uuid" },
					status: {
						type: "string",
						enum: ["processing", "completed"],
					},
					message: { type: "string", nullable: true },
				},
				required: ["scanId", "status"],
			},
			RoiReportRequest: {
				type: "object",
				properties: {
					projectId: {
						type: "string",
						format: "uuid",
						description: "ID des Monitoring-Projekts",
					},
				},
				required: ["projectId"],
			},
			RoiReportCreateResponse: {
				type: "object",
				properties: {
					projectId: { type: "string", format: "uuid" },
					status: { type: "string", enum: ["processing"], example: "processing" },
				},
				required: ["projectId", "status"],
			},
			RoiReportListResponse: {
				type: "object",
				properties: {
					reports: {
						type: "array",
						items: {
							type: "object",
							properties: {
								id: { type: "string", format: "uuid" },
								createdAt: { type: "string", format: "date-time" },
								format: { type: "string", example: "pdf" },
								scoreDelta: { type: "number", example: 12 },
								citationDelta: { type: "number", example: 5 },
								generatedAt: {
									type: "string",
									format: "date-time",
									nullable: true,
								},
							},
							required: ["id", "createdAt", "format"],
						},
					},
				},
				required: ["reports"],
			},
			MonitoringOverview: {
				type: "object",
				description: "Aggregierte Monitoring-Daten: Erwähnung, Sichtbarkeit, Sentiment-Verteilung.",
				properties: {
					totalMentions: { type: "integer", example: 142 },
					visibilityScore: { type: "number", example: 78.5 },
					sentimentDistribution: {
						type: "object",
						properties: {
							positive: { type: "integer" },
							neutral: { type: "integer" },
							negative: { type: "integer" },
						},
					},
				},
			},
			MentionItem: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					projectId: { type: "string", format: "uuid" },
					snapshotId: { type: "string", format: "uuid" },
					brandName: { type: "string", example: "ACME GmbH" },
					mentionType: { type: "string", example: "direct" },
					model: { type: "string", nullable: true, example: "gpt-4" },
					position: { type: "integer", nullable: true, example: 3 },
					contextText: { type: "string", nullable: true },
					sentiment: {
						type: "string",
						nullable: true,
						enum: ["positive", "neutral", "negative"],
					},
					mentionedAt: { type: "string", format: "date-time" },
				},
				required: ["id", "projectId", "snapshotId", "brandName", "mentionType", "mentionedAt"],
			},
			MentionsResponse: {
				type: "object",
				properties: {
					items: { type: "array", items: { $ref: "#/components/schemas/MentionItem" } },
					nextCursor: { type: "string", nullable: true },
				},
				required: ["items", "nextCursor"],
			},
			RankingItem: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					projectId: { type: "string", format: "uuid" },
					snapshotId: { type: "string", format: "uuid" },
					brandName: { type: "string", example: "ACME GmbH" },
					model: { type: "string", example: "gpt-4" },
					rankPosition: { type: "integer", example: 2 },
					competitorName: { type: "string", nullable: true },
					queryText: { type: "string", example: "beste SEO Agentur" },
					rankedAt: { type: "string", format: "date-time" },
				},
				required: [
					"id",
					"projectId",
					"snapshotId",
					"brandName",
					"model",
					"rankPosition",
					"queryText",
					"rankedAt",
				],
			},
			RankingsResponse: {
				type: "object",
				properties: {
					items: { type: "array", items: { $ref: "#/components/schemas/RankingItem" } },
					nextCursor: { type: "string", nullable: true },
				},
				required: ["items", "nextCursor"],
			},
			DeployRequest: {
				type: "object",
				properties: {
					fixId: {
						type: "string",
						format: "uuid",
						description: "ID des zu deployenden Fixes",
					},
					cmsConnectionId: {
						type: "string",
						format: "uuid",
						description: "ID der CMS-Verbindung",
					},
				},
				required: ["fixId", "cmsConnectionId"],
			},
			DeployResponse: {
				type: "object",
				properties: {
					deploymentAttemptId: { type: "string", format: "uuid" },
					status: { type: "string", enum: ["pending"], example: "pending" },
				},
				required: ["deploymentAttemptId", "status"],
			},
			RollbackResponse: {
				type: "object",
				properties: {
					deploymentAttemptId: { type: "string", format: "uuid" },
					status: {
						type: "string",
						enum: ["rolling_back"],
						example: "rolling_back",
					},
				},
				required: ["deploymentAttemptId", "status"],
			},
		},
	},
	security: [{ bearerAuth: [] }],
	paths: {
		// ─── Public ────────────────────────────────────────
		"/health": {
			get: {
				operationId: "getHealth",
				tags: ["Oeffentlich"],
				summary: "Systemstatus prüfen",
				description:
					"Health-Check-Endpunkt zur Überwachung der Verfügbarkeit. Prüft DB- und Redis-Konnektivität.",
				security: [],
				responses: {
					"200": {
						description: "System ist bereit",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/HealthResponse" },
							},
						},
					},
					"503": {
						description: "System ist eingeschraenkt verfügbar",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/HealthResponse" },
							},
						},
					},
				},
			},
		},

		"/public/audit": {
			post: {
				operationId: "createPublicAudit",
				tags: ["Oeffentlich"],
				summary: "Kostenlosen Audit starten",
				description:
					"Startet einen oeffentlichen AI-Readiness-Audit ohne Anmeldung. Limitiert auf 3 Anfragen pro Tag und IP.",
				security: [],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/PublicAuditRequest" },
						},
					},
				},
				responses: {
					"202": {
						description: "Audit wurde in die Warteschlange gestellt",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/PublicAuditResponse" },
							},
						},
					},
					"400": {
						description: "Ungültige Eingabe",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"429": {
						description: "Rate-Limit überschritten",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		"/public/audit/{jobId}": {
			get: {
				operationId: "getPublicAuditStatus",
				tags: ["Oeffentlich"],
				summary: "Audit-Status abfragen",
				description:
					"Gibt den aktuellen Status eines oeffentlichen Audits zurück. Bei Abschluss enthaelt die Antwort das Ergebnis.",
				security: [],
				parameters: [UuidParam("jobId", "Job-ID des Audits")],
				responses: {
					"200": {
						description: "Audit-Status",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/PublicAuditStatusResponse",
								},
							},
						},
					},
					"400": {
						description: "Ungültige Job-ID",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"404": {
						description: "Audit nicht gefunden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"429": {
						description: "Rate-Limit überschritten",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		// ─── Scan ──────────────────────────────────────────
		"/scan": {
			post: {
				operationId: "createScan",
				tags: ["Scan"],
				summary: "Neuen Scan starten",
				description:
					"Startet einen AI-Readiness-Scan für die angegebene URL. Funktioniert mit und ohne Authentifizierung (anonyme Scans haben niedrigere Limits).",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/ScanRequest" },
						},
					},
				},
				responses: {
					"202": {
						description: "Scan wurde in die Warteschlange gestellt",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ScanCreateResponse" },
							},
						},
					},
					"400": {
						description: "Ungültige URL oder Request-Body",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"429": {
						description: "Scan-Limit erreicht",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ErrorWithUpgrade" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		"/scan/{id}": {
			get: {
				operationId: "getScan",
				tags: ["Scan"],
				summary: "Scan-Ergebnis abrufen",
				description:
					"Gibt das vollständige Ergebnis eines Scans zurück. Erfordert Eigentuemerschaft oder einen gueltigen Access-Token.",
				parameters: [UuidParam("id", "Scan-ID")],
				responses: {
					"200": {
						description: "Scan-Ergebnis",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ScanResult" },
							},
						},
					},
					"400": {
						description: "Ungültige Scan-ID",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"404": {
						description: "Scan nicht gefunden oder kein Zugriff",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"429": {
						description: "Rate-Limit überschritten",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		"/scan/{id}/fix": {
			get: {
				operationId: "getScanFixStatuses",
				tags: ["Fix"],
				summary: "Fix-Status pro Check abrufen",
				description:
					"Gibt den aktuellen Fix-Status aller Checks eines Scans zurück. Erfordert Authentifizierung und Eigentuemerschaft.",
				parameters: [UuidParam("id", "Scan-ID")],
				responses: {
					"200": {
						description: "Fix-Status-Uebersicht",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/FixStatusResponse" },
							},
						},
					},
					"400": {
						description: "Ungültige Scan-ID",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"401": {
						description: "Nicht authentifiziert",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"404": {
						description: "Scan nicht gefunden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"429": {
						description: "Rate-Limit überschritten",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		"/scan/{id}/analysis": {
			get: {
				operationId: "getScanAnalysis",
				tags: ["Scan"],
				summary: "Analyse-Status abrufen",
				description:
					"Gibt den Status der semantischen und Zitations-Analyse eines Scans zurück. Enthaelt bei Abschluss die Analyseergebnisse.",
				parameters: [UuidParam("id", "Scan-ID")],
				responses: {
					"200": {
						description: "Analyse-Status mit optionalen Ergebnissen",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/AnalysisStatusResponse",
								},
							},
						},
					},
					"400": {
						description: "Ungültige Scan-ID",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"401": {
						description: "Nicht authentifiziert",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"404": {
						description: "Scan nicht gefunden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"429": {
						description: "Rate-Limit überschritten",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		"/scan/{id}/report": {
			get: {
				operationId: "getScanReportStatus",
				tags: ["Report"],
				summary: "Report-Status abfragen",
				description: "Gibt den Generierungsstatus des PDF-Reports für einen Scan zurück.",
				parameters: [UuidParam("id", "Scan-ID")],
				responses: {
					"200": {
						description: "Report-Status",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ReportStatusResponse" },
							},
						},
					},
					"400": {
						description: "Ungültige Scan-ID",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"401": {
						description: "Nicht authentifiziert",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"404": {
						description: "Scan nicht gefunden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"429": {
						description: "Rate-Limit überschritten",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		// ─── Fix ───────────────────────────────────────────
		"/fix": {
			post: {
				operationId: "createFix",
				tags: ["Fix"],
				summary: "Fix generieren",
				description:
					"Startet die KI-gestützte Fix-Generierung für einen einzelnen Check. Gibt bei bereits vorhandenem Fix sofort das Ergebnis zurück.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/FixRequest" },
						},
					},
				},
				responses: {
					"200": {
						description: "Fix bereits vorhanden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/FixResponse" },
							},
						},
					},
					"202": {
						description: "Fix-Generierung wurde gestartet",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/FixResponse" },
							},
						},
					},
					"400": {
						description: "Ungültige Eingabe",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"401": {
						description: "Nicht authentifiziert",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"403": {
						description: "Feature nicht im aktuellen Plan verfügbar oder Quota erschoepft",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ErrorWithUpgrade" },
							},
						},
					},
					"404": {
						description: "Scan oder Check nicht gefunden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		// ─── Analyze ───────────────────────────────────────
		"/analyze": {
			post: {
				operationId: "createAnalysis",
				tags: ["Scan"],
				summary: "KI-Analyse starten",
				description:
					"Startet eine semantische und/oder Zitations-Analyse für einen abgeschlossenen Scan. Unterstützte Typen: semantic, citation, both.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/AnalyzeRequest" },
						},
					},
				},
				responses: {
					"200": {
						description: "Analyse bereits abgeschlossen",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/AnalyzeResponse" },
							},
						},
					},
					"202": {
						description: "Analyse wurde gestartet",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/AnalyzeResponse" },
							},
						},
					},
					"400": {
						description: "Ungültige Eingabe",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"401": {
						description: "Nicht authentifiziert",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"403": {
						description: "Feature nicht im aktuellen Plan verfügbar",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ErrorWithUpgrade" },
							},
						},
					},
					"404": {
						description: "Scan nicht gefunden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"409": {
						description: "Analyse läuft bereits oder Scan noch nicht abgeschlossen",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		// ─── Report ────────────────────────────────────────
		"/report": {
			post: {
				operationId: "createReport",
				tags: ["Report"],
				summary: "PDF-Report generieren",
				description:
					"Startet die Generierung eines PDF-Reports für einen abgeschlossenen Scan. Optionales Custom-Branding für Agency-Plan.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/ReportRequest" },
						},
					},
				},
				responses: {
					"200": {
						description: "Report bereits vorhanden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ReportCreateResponse" },
							},
						},
					},
					"202": {
						description: "Report-Generierung gestartet",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ReportCreateResponse" },
							},
						},
					},
					"400": {
						description: "Ungültige Eingabe",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"401": {
						description: "Nicht authentifiziert",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"403": {
						description: "PDF-Reports nicht im aktuellen Plan verfügbar",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ErrorWithUpgrade" },
							},
						},
					},
					"404": {
						description: "Scan nicht gefunden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"409": {
						description: "Report wird bereits generiert oder Scan nicht abgeschlossen",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		"/report/{id}": {
			get: {
				operationId: "downloadReport",
				tags: ["Report"],
				summary: "PDF-Report herunterladen",
				description:
					"Laedt den generierten PDF-Report für einen Scan herunter. Erfordert Eigentuemerschaft und passenden Plan.",
				parameters: [UuidParam("id", "Scan-ID")],
				responses: {
					"200": {
						description: "PDF-Datei",
						content: {
							"application/pdf": {
								schema: { type: "string", format: "binary" },
							},
						},
					},
					"400": {
						description: "Ungültige Scan-ID",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"401": {
						description: "Nicht authentifiziert",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"403": {
						description: "PDF-Reports nicht im aktuellen Plan verfügbar",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"404": {
						description: "Scan oder Report nicht gefunden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"409": {
						description: "Scan noch nicht abgeschlossen",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"410": {
						description: "Scan ist abgelaufen",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		// ─── ROI ───────────────────────────────────────────
		"/roi-report": {
			post: {
				operationId: "createRoiReport",
				tags: ["ROI"],
				summary: "ROI-Report generieren",
				description:
					"Startet die Generierung eines ROI-Reports für ein Monitoring-Projekt. Erfordert passenden Plan mit PDF-Export.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/RoiReportRequest" },
						},
					},
				},
				responses: {
					"202": {
						description: "ROI-Report-Generierung gestartet",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/RoiReportCreateResponse" },
							},
						},
					},
					"400": {
						description: "Ungültige Projekt-ID",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"401": {
						description: "Nicht authentifiziert",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"403": {
						description: "ROI-Reports nicht im aktuellen Plan verfügbar",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ErrorWithUpgrade" },
							},
						},
					},
					"404": {
						description: "Projekt nicht gefunden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
			get: {
				operationId: "listRoiReports",
				tags: ["ROI"],
				summary: "ROI-Report-Historie abrufen",
				description: "Gibt eine Liste aller generierten ROI-Reports für ein Projekt zurück.",
				parameters: [ProjectIdQuery],
				responses: {
					"200": {
						description: "Liste der ROI-Reports",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/RoiReportListResponse" },
							},
						},
					},
					"400": {
						description: "Fehlender oder ungültiger projectId-Parameter",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"401": {
						description: "Nicht authentifiziert",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"404": {
						description: "Projekt nicht gefunden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		"/roi-report/{id}": {
			get: {
				operationId: "downloadRoiReport",
				tags: ["ROI"],
				summary: "ROI-Report herunterladen",
				description:
					"Laedt den generierten ROI-Report als PDF herunter. Erfordert Eigentuemerschaft am zugehörigen Projekt.",
				parameters: [UuidParam("id", "Report-ID")],
				responses: {
					"200": {
						description: "PDF-Datei",
						content: {
							"application/pdf": {
								schema: { type: "string", format: "binary" },
							},
						},
					},
					"400": {
						description: "Ungültige Report-ID",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"401": {
						description: "Nicht authentifiziert",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"404": {
						description: "Report nicht gefunden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		// ─── Monitoring ────────────────────────────────────
		"/monitoring/overview": {
			get: {
				operationId: "getMonitoringOverview",
				tags: ["Monitoring"],
				summary: "Monitoring-Uebersicht abrufen",
				description:
					"Gibt aggregierte Monitoring-Daten (Erwähnung, Sichtbarkeit, Sentiment) für ein Projekt zurück. Optionale Zeitraum-Filter.",
				parameters: [
					ProjectIdQuery,
					{
						name: "from",
						in: "query",
						required: false,
						schema: { type: "string", format: "date-time" },
						description: "Startdatum des Zeitraums",
					},
					{
						name: "to",
						in: "query",
						required: false,
						schema: { type: "string", format: "date-time" },
						description: "Enddatum des Zeitraums",
					},
				],
				responses: {
					"200": {
						description: "Aggregierte Monitoring-Daten",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/MonitoringOverview" },
							},
						},
					},
					"400": {
						description: "Fehlende oder ungültige Parameter",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"401": {
						description: "Nicht authentifiziert",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"404": {
						description: "Projekt nicht gefunden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		"/monitoring/mentions": {
			get: {
				operationId: "getMonitoringMentions",
				tags: ["Monitoring"],
				summary: "Erwähnung auflisten",
				description:
					"Gibt paginierte Erwähnung für ein Projekt zurück. Unterstützt Filter nach Modell, Sentiment und Zeitraum.",
				parameters: [
					ProjectIdQuery,
					{
						name: "model",
						in: "query",
						required: false,
						schema: { type: "array", items: { type: "string" } },
						description: "KI-Modell-Filter (mehrfach möglich)",
					},
					{
						name: "sentiment",
						in: "query",
						required: false,
						schema: {
							type: "array",
							items: {
								type: "string",
								enum: ["positive", "neutral", "negative"],
							},
						},
						description: "Sentiment-Filter",
					},
					{
						name: "mentionType",
						in: "query",
						required: false,
						schema: { type: "string" },
						description: "Typ der Erwaehnunge",
					},
					{
						name: "from",
						in: "query",
						required: false,
						schema: { type: "string", format: "date-time" },
					},
					{
						name: "to",
						in: "query",
						required: false,
						schema: { type: "string", format: "date-time" },
					},
					{
						name: "cursor",
						in: "query",
						required: false,
						schema: { type: "string" },
						description: "Cursor für Pagination",
					},
					{
						name: "limit",
						in: "query",
						required: false,
						schema: { type: "integer", default: 20 },
					},
					{
						name: "sort",
						in: "query",
						required: false,
						schema: { type: "string" },
					},
					{
						name: "dir",
						in: "query",
						required: false,
						schema: { type: "string", enum: ["asc", "desc"] },
					},
				],
				responses: {
					"200": {
						description: "Paginierte Erwaehnungsliste",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/MentionsResponse" },
							},
						},
					},
					"400": {
						description: "Ungültige Parameter",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"401": {
						description: "Nicht authentifiziert",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"404": {
						description: "Projekt nicht gefunden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		"/monitoring/rankings": {
			get: {
				operationId: "getMonitoringRankings",
				tags: ["Monitoring"],
				summary: "Ranking-Daten abrufen",
				description:
					"Gibt paginierte Ranking-Positionen für ein Projekt zurück. Zeigt wo die Marke in KI-Antworten positioniert wird.",
				parameters: [
					ProjectIdQuery,
					{
						name: "model",
						in: "query",
						required: false,
						schema: { type: "string" },
						description: "Filter nach KI-Modell",
					},
					{
						name: "brand",
						in: "query",
						required: false,
						schema: { type: "string" },
						description: "Filter nach Markenname",
					},
					{
						name: "from",
						in: "query",
						required: false,
						schema: { type: "string", format: "date-time" },
					},
					{
						name: "to",
						in: "query",
						required: false,
						schema: { type: "string", format: "date-time" },
					},
					{
						name: "cursor",
						in: "query",
						required: false,
						schema: { type: "string" },
						description: "Cursor für Pagination",
					},
					{
						name: "limit",
						in: "query",
						required: false,
						schema: { type: "integer", default: 20 },
					},
				],
				responses: {
					"200": {
						description: "Paginierte Ranking-Liste",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/RankingsResponse" },
							},
						},
					},
					"400": {
						description: "Ungültige Parameter",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"401": {
						description: "Nicht authentifiziert",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"404": {
						description: "Projekt nicht gefunden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		// ─── Deployments ───────────────────────────────────
		"/deployments": {
			post: {
				operationId: "createDeployment",
				tags: ["Deployment"],
				summary: "One-Click-Deployment starten",
				description:
					"Deployt einen generierten Fix über eine bestehende CMS-Verbindung. Erfordert passenden Plan und Quota.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/DeployRequest" },
						},
					},
				},
				responses: {
					"202": {
						description: "Deployment wurde gestartet",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/DeployResponse" },
							},
						},
					},
					"400": {
						description: "Ungültige Eingabe",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"401": {
						description: "Nicht authentifiziert",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"403": {
						description: "Feature nicht im aktuellen Plan verfügbar oder Quota erschoepft",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ErrorWithUpgrade" },
							},
						},
					},
					"404": {
						description: "Fix oder CMS-Verbindung nicht gefunden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"422": {
						description: "CMS unterstützt den Fix-Typ nicht",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},

		"/deployments/{id}/rollback": {
			post: {
				operationId: "rollbackDeployment",
				tags: ["Deployment"],
				summary: "Deployment zurücksetzen",
				description:
					"Setzt ein erfolgreiches Deployment zurück. Nur möglich wenn Rollback-Daten vorhanden sind.",
				parameters: [UuidParam("id", "Deployment-Attempt-ID")],
				requestBody: {
					required: false,
					content: {
						"application/json": {
							schema: { type: "object" },
						},
					},
				},
				responses: {
					"202": {
						description: "Rollback wurde gestartet",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/RollbackResponse" },
							},
						},
					},
					"400": {
						description: "Ungültige Deployment-ID",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"401": {
						description: "Nicht authentifiziert",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"404": {
						description: "Deployment nicht gefunden",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"409": {
						description:
							"Deployment kann nicht zurückgesetzt werden (falscher Status oder fehlende Rollback-Daten)",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"500": {
						description: "Interner Serverfehler",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
				},
			},
		},
	},
};
