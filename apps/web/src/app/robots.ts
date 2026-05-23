import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
			},
			{
				userAgent: "GPTBot",
				allow: "/",
			},
			{
				userAgent: "ClaudeBot",
				allow: "/",
			},
			{
				userAgent: "PerplexityBot",
				allow: "/",
			},
			{
				userAgent: "GoogleOther",
				allow: "/",
			},
			{
				userAgent: "Applebot-Extended",
				allow: "/",
			},
		],
		sitemap: `${baseUrl}/sitemap.xml`,
	};
}
