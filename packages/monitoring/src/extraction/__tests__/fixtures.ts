import type { BrandConfig } from "../types.js";

// ── Brand Configs ───────────────────────────────────────────

export const SIMPLE_BRAND: BrandConfig = {
	canonicalName: "Acme Corp",
	primaryNames: ["Acme Corp", "Acme"],
	domains: ["acme.com"],
};

export const BRAND_WITH_VARIANTS: BrandConfig = {
	canonicalName: "Amazon Web Services",
	primaryNames: ["Amazon Web Services", "AWS"],
	domains: ["aws.amazon.com"],
};

export const BRAND_SPECIAL_CHARS: BrandConfig = {
	canonicalName: "AT&T",
	primaryNames: ["AT&T", "ATT"],
	domains: ["att.com"],
};

export const BRAND_SHORT: BrandConfig = {
	canonicalName: "SAP",
	primaryNames: ["SAP"],
	domains: ["sap.com"],
};

export const BRAND_VERY_SHORT: BrandConfig = {
	canonicalName: "AI",
	primaryNames: ["AI"],
	domains: [],
};

export const BRAND_GERMAN: BrandConfig = {
	canonicalName: "Deutsche Telekom",
	primaryNames: ["Deutsche Telekom", "Telekom"],
	domains: ["telekom.de"],
};

export const BRAND_COMMON_WORD: BrandConfig = {
	canonicalName: "Apple",
	primaryNames: ["Apple"],
	domains: ["apple.com"],
};

// ── AI Response Texts ───────────────────────────────────────

export const RESPONSE_RECOMMENDATION =
	"When it comes to cloud infrastructure, I would highly recommend Amazon Web Services (AWS). Their platform offers excellent scalability and reliability. AWS has been the leading cloud provider for years and continues to innovate with new services.";

export const RESPONSE_COMPARISON =
	"When comparing Acme Corp and their competitors, Acme stands out in terms of reliability. Compared to other providers, Acme Corp offers better pricing while maintaining quality. However, alternatives like Beta Inc provide more features.";

export const RESPONSE_CITATION = `According to AT&T's latest quarterly report, the company has expanded its 5G coverage to 200 million people. AT&T states that their network reliability has improved by 15% year over year.`;

export const RESPONSE_NO_MENTIONS =
	"The weather forecast for tomorrow indicates clear skies with temperatures around 22 degrees Celsius. Wind speeds will be moderate throughout the day.";

export const RESPONSE_MULTIPLE_BRANDS =
	"In the enterprise software market, SAP dominates ERP solutions. Meanwhile, Amazon Web Services leads cloud infrastructure. Both SAP and AWS continue to expand their partnerships.";

export const RESPONSE_WITH_URLS =
	"For more information, visit https://acme.com/products to see their full catalog. You can also check https://example.com/reviews for independent reviews of Acme Corp products.";

export const RESPONSE_GERMAN =
	"Für Cloud-Hosting empfehle ich Amazon Web Services. Deren Plattform bietet hervorragende Skalierbarkeit. AWS ist der führende Cloud-Anbieter und bietet zuverlässige Dienste.";

export const RESPONSE_MISSPELLED = `I've been using Amazn Web Services for our infrastructure. Their Amzon platform is quite reliable and the pricing is competitive.`;

export const RESPONSE_PASSING =
	"Several companies including Acme Corp, Beta Inc, and Gamma Ltd are participating in the upcoming tech conference. The event will feature presentations from all three organizations.";

export const RESPONSE_LONG = `${"Lorem ipsum dolor sit amet. ".repeat(50)}In the middle of this text, we find that Acme Corp has been mentioned. ${"Consectetur adipiscing elit. ".repeat(50)}And here at the end, Acme appears again with excellent results.`;
