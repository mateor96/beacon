import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	async redirects() {
		return [
			{
				source: "/free-audit",
				destination: "/ai-sichtbarkeit-check",
				permanent: true,
			},
		];
	},
	async rewrites() {
		return [
			{
				source: "/api/v1/:path*",
				destination: "/api/:path*",
			},
		];
	},
	transpilePackages: [
		"@beacon/shared",
		"@beacon/db",
		"@beacon/scanner",
		"@beacon/queue",
		"@beacon/monitoring",
	],
	webpack: (config) => {
		// Resolve .ts source files for transpiled packages that use .js extensions in imports
		config.resolve.extensionAlias = {
			".js": [".ts", ".tsx", ".js"],
		};
		return config;
	},
};

export default nextConfig;
