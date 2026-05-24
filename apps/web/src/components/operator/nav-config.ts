/**
 * Single source of truth for the operator sidebar navigation.
 *
 * Operator pages live under the `(operator)` route group (URL-transparent),
 * so these hrefs match the public URLs. Labels are German per project
 * convention. `/docs/api` lives outside the operator group (full-page Scalar
 * reference) but is linked here for discoverability.
 */

export interface NavItem {
	href: string;
	label: string;
}

export interface NavGroup {
	label: string;
	items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
	{
		label: "Übersicht",
		items: [{ href: "/dashboard", label: "Dashboard" }],
	},
	{
		label: "Monitoring",
		items: [
			{ href: "/monitoring", label: "Projekte" },
			{ href: "/citations", label: "Citations" },
		],
	},
	{
		label: "Integrationen",
		items: [
			{ href: "/cms-connections", label: "CMS-Verbindungen" },
			{ href: "/webhooks", label: "Webhooks" },
			{ href: "/admin/api-token", label: "API-Token" },
			{ href: "/docs/api", label: "API-Referenz" },
		],
	},
	{
		label: "System",
		items: [{ href: "/status", label: "Status & Health" }],
	},
];
