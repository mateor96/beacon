"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type CmsType = "wordpress" | "webflow" | "shopify";
type FormState = "idle" | "submitting" | "error";

export function NewCmsConnectionForm() {
	const router = useRouter();
	const [cmsType, setCmsType] = useState<CmsType>("wordpress");
	const [siteUrl, setSiteUrl] = useState("");
	const [label, setLabel] = useState("");

	// WordPress
	const [wpBaseUrl, setWpBaseUrl] = useState("");
	const [wpUsername, setWpUsername] = useState("");
	const [wpAppPassword, setWpAppPassword] = useState("");

	// Webflow
	const [wfSiteId, setWfSiteId] = useState("");
	const [wfApiToken, setWfApiToken] = useState("");

	// Shopify
	const [shShopDomain, setShShopDomain] = useState("");
	const [shAccessToken, setShAccessToken] = useState("");

	const [state, setState] = useState<FormState>("idle");
	const [errorMessage, setErrorMessage] = useState("");

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (state === "submitting") return;

		let credentials: Record<string, string>;
		let payloadSiteUrl = siteUrl;
		if (cmsType === "wordpress") {
			credentials = {
				baseUrl: wpBaseUrl,
				username: wpUsername,
				appPassword: wpAppPassword,
			};
		} else if (cmsType === "webflow") {
			credentials = { siteId: wfSiteId, apiToken: wfApiToken };
		} else {
			// Shopify uses shopDomain instead of a regular URL.
			credentials = { shopDomain: shShopDomain, accessToken: shAccessToken };
			payloadSiteUrl = shShopDomain;
		}

		setState("submitting");
		setErrorMessage("");

		try {
			const res = await fetch("/api/cms-connections", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					cmsType,
					siteUrl: payloadSiteUrl,
					label: label || undefined,
					credentials,
				}),
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error ?? "Konnte die Verbindung nicht anlegen.");
			}
			router.push("/cms-connections");
		} catch (err) {
			setState("error");
			setErrorMessage(err instanceof Error ? err.message : "Unbekannter Fehler.");
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			<div>
				<label htmlFor="cms-type" className="block text-sm font-medium text-text">
					CMS
				</label>
				<select
					id="cms-type"
					value={cmsType}
					onChange={(e) => setCmsType(e.target.value as CmsType)}
					className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				>
					<option value="wordpress">WordPress</option>
					<option value="webflow">Webflow</option>
					<option value="shopify">Shopify</option>
				</select>
			</div>

			<div>
				<label htmlFor="conn-label" className="block text-sm font-medium text-text">
					Label <span className="text-text-muted">(optional)</span>
				</label>
				<input
					id="conn-label"
					type="text"
					maxLength={100}
					value={label}
					onChange={(e) => setLabel(e.target.value)}
					placeholder="z.B. Produktiv-Shop"
					className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
			</div>

			{cmsType !== "shopify" && (
				<div>
					<label htmlFor="conn-url" className="block text-sm font-medium text-text">
						Site-URL
					</label>
					<input
						id="conn-url"
						type="text"
						inputMode="url"
						required
						value={siteUrl}
						onChange={(e) => setSiteUrl(e.target.value)}
						placeholder="z.B. beispiel.de"
						className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
					/>
				</div>
			)}

			{cmsType === "wordpress" && (
				<fieldset className="space-y-4 rounded-lg border border-border bg-surface p-4">
					<legend className="px-2 text-sm font-medium text-text">WordPress-Zugangsdaten</legend>
					<div>
						<label htmlFor="wp-baseurl" className="block text-sm font-medium text-text">
							WP-Base-URL (REST API)
						</label>
						<input
							id="wp-baseurl"
							type="text"
							required
							value={wpBaseUrl}
							onChange={(e) => setWpBaseUrl(e.target.value)}
							placeholder="z.B. https://beispiel.de"
							className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-text"
						/>
					</div>
					<div>
						<label htmlFor="wp-user" className="block text-sm font-medium text-text">
							Benutzername
						</label>
						<input
							id="wp-user"
							type="text"
							required
							value={wpUsername}
							onChange={(e) => setWpUsername(e.target.value)}
							className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-text"
						/>
					</div>
					<div>
						<label htmlFor="wp-pass" className="block text-sm font-medium text-text">
							Anwendungspasswort
						</label>
						<input
							id="wp-pass"
							type="password"
							required
							value={wpAppPassword}
							onChange={(e) => setWpAppPassword(e.target.value)}
							className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-text"
						/>
					</div>
				</fieldset>
			)}

			{cmsType === "webflow" && (
				<fieldset className="space-y-4 rounded-lg border border-border bg-surface p-4">
					<legend className="px-2 text-sm font-medium text-text">Webflow-Zugangsdaten</legend>
					<div>
						<label htmlFor="wf-siteid" className="block text-sm font-medium text-text">
							Site-ID
						</label>
						<input
							id="wf-siteid"
							type="text"
							required
							value={wfSiteId}
							onChange={(e) => setWfSiteId(e.target.value)}
							className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-text"
						/>
					</div>
					<div>
						<label htmlFor="wf-token" className="block text-sm font-medium text-text">
							API-Token
						</label>
						<input
							id="wf-token"
							type="password"
							required
							value={wfApiToken}
							onChange={(e) => setWfApiToken(e.target.value)}
							className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-text"
						/>
					</div>
				</fieldset>
			)}

			{cmsType === "shopify" && (
				<fieldset className="space-y-4 rounded-lg border border-border bg-surface p-4">
					<legend className="px-2 text-sm font-medium text-text">Shopify-Zugangsdaten</legend>
					<div>
						<label htmlFor="sh-domain" className="block text-sm font-medium text-text">
							Shop-Domain
						</label>
						<input
							id="sh-domain"
							type="text"
							required
							value={shShopDomain}
							onChange={(e) => setShShopDomain(e.target.value)}
							placeholder="meinshop.myshopify.com"
							className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-text"
						/>
					</div>
					<div>
						<label htmlFor="sh-token" className="block text-sm font-medium text-text">
							Access-Token (Admin API)
						</label>
						<input
							id="sh-token"
							type="password"
							required
							value={shAccessToken}
							onChange={(e) => setShAccessToken(e.target.value)}
							className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-text"
						/>
					</div>
				</fieldset>
			)}

			{state === "error" && (
				<p role="alert" className="text-sm text-danger">
					{errorMessage}
				</p>
			)}

			<div className="flex gap-3">
				<button
					type="submit"
					disabled={state === "submitting"}
					className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover disabled:opacity-60"
				>
					{state === "submitting" ? "Speichere…" : "Verbindung anlegen"}
				</button>
				<a
					href="/cms-connections"
					className="rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface"
				>
					Abbrechen
				</a>
			</div>
		</form>
	);
}
