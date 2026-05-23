# Security policy

## Reporting a vulnerability

If you believe you've found a security issue in Beacon, please report it
privately rather than via a public GitHub issue.

- Open a GitHub **private vulnerability report** on this repository, or
- Email the maintainers (see commit log for current addresses).

Please include:

1. A description of the vulnerability and its impact.
2. Steps to reproduce — proof-of-concept code is welcome.
3. The affected version / commit.
4. Any suggested remediation if you have one.

We aim to acknowledge reports within **72 hours** and to land a fix or
mitigation for verified issues within **30 days** for high-severity
findings.

## What is in scope

Beacon performs outbound HTTP requests to user-supplied URLs as part of
scanning. The interesting attack surface includes:

- **SSRF** in the scan-fetch path (`packages/scanner/src/fetcher.ts`).
- **Prompt injection** into the AI fix/analysis pipeline
  (`packages/ai/`).
- **Server-side request forgery** via webhooks (if you re-enable the
  webhook delivery worker — see `CONTEXT.md`).
- **Path traversal** in report storage (`REPORT_STORAGE_PATH`).
- **Token forgery / replay** for signed `?access=` scan-result URLs
  (`packages/shared/src/scan-access.ts`).

## What is not in scope

- Issues that require a malicious operator (host of the Beacon instance)
  attacking their own users.
- Vulnerabilities in unmaintained third-party dependencies that have no
  Beacon-side fix. Please report those upstream.
- DoS via heavy single-request payloads on a free public instance — the
  operator is expected to set their own rate limits.

## Public disclosure

We prefer coordinated disclosure: please give us time to ship a fix
before publishing details. Once a fix is released we are happy to credit
reporters in the release notes if they want it.
