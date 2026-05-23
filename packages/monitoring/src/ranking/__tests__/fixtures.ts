import type { BrandConfig } from "../../extraction/types.js";

export const BRAND_ACME: BrandConfig = {
	canonicalName: "Acme Corp",
	primaryNames: ["Acme Corp", "Acme"],
	domains: ["acme.com"],
};

export const COMPETITORS = ["Salesforce", "HubSpot", "Pipedrive", "Zoho"];

export const RESPONSE_NUMBERED_LIST = `Here are the top 5 CRM tools for agencies:
1. Salesforce - Enterprise leader with comprehensive features
2. HubSpot - Best for small to medium businesses
3. Acme Corp - Great option for agencies with white-label needs
4. Pipedrive - Sales-focused CRM solution
5. Zoho - Budget-friendly alternative`;

export const RESPONSE_BULLET_LIST = `Recommended project management tools:
- Salesforce
- Acme Corp
- HubSpot
- Pipedrive`;

export const RESPONSE_HEADED_LIST = `### Salesforce
Enterprise CRM leader with comprehensive features.

### Acme Corp
Great for mid-market agencies.

### HubSpot
Best for SMBs.`;

export const RESPONSE_TOP_N = `Top 3 tools for web development agencies:
1. HubSpot - All-in-one marketing platform
2. Acme Corp - Specialized agency tooling
3. Salesforce - Enterprise capabilities`;

export const RESPONSE_PROSE_ONLY =
	"When looking for CRM solutions, Salesforce remains the market leader. HubSpot has gained significant traction. Acme Corp offers a solid mid-market option. Zoho rounds out the contenders.";

export const RESPONSE_NO_BRAND = `The top providers are:
1. Salesforce - Enterprise leader
2. HubSpot - Best for SMBs
3. Pipedrive - Sales focused`;

export const RESPONSE_BRAND_ONLY =
	"For this use case, Acme Corp is the clear choice. Their platform provides everything you need for agency management.";

export const RESPONSE_PARENTHESIS_LIST = `Best tools for agencies:
1) Acme Corp
2) Salesforce
3) HubSpot`;

export const RESPONSE_TWO_ITEMS = `Options to consider:
1. Acme Corp
2. Salesforce`;

export const RESPONSE_GERMAN_LIST = `Die besten CRM-Tools für Agenturen:
1. Salesforce - Marktfuehrer für Unternehmen
2. Acme Corp - Ideal für Agenturen
3. HubSpot - Gut für kleine Unternehmen`;

export const RESPONSE_MIXED = `I'd recommend looking into several options. Here are my top picks:
1. Salesforce - Comprehensive enterprise CRM
2. Acme Corp - Great for agencies
3. HubSpot - Good for small teams
Overall, Acme Corp stands out for agency-specific features.`;

export const RESPONSE_EMPTY = "";

export const RESPONSE_NO_LIST = "The weather is nice today. Nothing about CRM tools.";
