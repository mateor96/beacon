/**
 * Checks if content appears to be an HTML response (soft-404 detection).
 * Used to detect when a server returns an HTML error page instead of
 * the expected text/XML/JSON resource.
 */
export function isHtmlResponse(content: string): boolean {
	const trimmed = content.trimStart();
	return (
		trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html") || trimmed.startsWith("<HTML")
	);
}
