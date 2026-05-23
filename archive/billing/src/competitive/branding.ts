import type { DbClient } from "@beacon/db";
import { profileQueries } from "@beacon/db";
import type { BrandingConfig } from "@beacon/shared";

export const BEACON_DEFAULT_BRANDING: BrandingConfig = {
	agencyName: "Beacon",
	primaryColor: "#2563eb",
	secondaryColor: "#1e40af",
	accentColor: "#16a34a",
	footerText: "Erstellt mit Beacon — Agentic Web Readiness",
	contactWebsite: "https://example.com",
};

/**
 * Resolve branding for a user with fallback to Beacon defaults. Used by the
 * PDF generator (#242) and the agency configuration UI (#251) to render
 * a live preview.
 */
export async function getBrandingForUser(db: DbClient, userId: string): Promise<BrandingConfig> {
	try {
		const persisted = await profileQueries.getBranding(db, userId);
		if (!persisted) return BEACON_DEFAULT_BRANDING;
		return {
			...BEACON_DEFAULT_BRANDING,
			...persisted,
		};
	} catch {
		return BEACON_DEFAULT_BRANDING;
	}
}
