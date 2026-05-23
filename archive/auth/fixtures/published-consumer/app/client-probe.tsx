"use client";

import { createAppBrowserClient } from "@beacon/auth/browser";

export default function ClientProbe() {
	// Prove client-side import resolves at build time
	void createAppBrowserClient;

	return <p>Browser client: OK</p>;
}
