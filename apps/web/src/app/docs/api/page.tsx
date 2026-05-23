"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

export default function ApiDocsPage() {
	return (
		<ApiReferenceReact
			configuration={{
				url: "/api/openapi.json",
				theme: "deepSpace",
				layout: "modern",
				hideModels: false,
				hideDownloadButton: false,
				metaData: {
					title: "Beacon API Dokumentation",
					description: "Interaktive API-Referenz für die Beacon-Plattform",
				},
			}}
		/>
	);
}
