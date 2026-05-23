import {
	AUTH_VERSION,
	DEFAULT_LOGIN_REDIRECT,
	createAppServerClient,
	createServiceClient,
} from "@beacon/auth";

import ClientProbe from "./client-probe";

export default function Page() {
	// Prove server-side imports resolve at build time
	void createAppServerClient;
	void createServiceClient;

	return (
		<main>
			<h1>Auth Contract Probe</h1>
			<p>Version: {AUTH_VERSION}</p>
			<p>Login redirect: {DEFAULT_LOGIN_REDIRECT}</p>
			<ClientProbe />
		</main>
	);
}
