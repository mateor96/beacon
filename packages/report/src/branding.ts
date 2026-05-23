import type { BrandingConfig } from "@beacon/shared";

export const DEFAULT_BRANDING: BrandingConfig = {
	agencyName: "Beacon - Agentic Web Readiness",
	primaryColor: "#0f172a",
	accentColor: "#3b82f6",
};

export function mergeBranding(custom?: Partial<BrandingConfig>): BrandingConfig {
	return { ...DEFAULT_BRANDING, ...custom };
}
