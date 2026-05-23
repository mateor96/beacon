/**
 * Versioned identifier for the current guarantee terms. Stored alongside
 * the claim (guarantee_claims.terms_version) so a change never invalidates
 * claims that were accepted under an older version.
 */
export const GUARANTEE_TERMS_VERSION = "2026-04-19-v1";

/**
 * Public route that renders the terms content. Used in milestone emails
 * (#238) and the status page (#272) so legal text always has a canonical URL.
 */
export const GUARANTEE_TERMS_PATH = "/guarantee/terms";
