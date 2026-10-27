# Security

Local Interviewer binds both servers to `127.0.0.1` by default and has no cloud auth, telemetry, analytics, or third-party speech API. Do not expose FastAPI directly to the public internet.

Provider URLs permit only HTTP(S) base origins, reject embedded credentials and paths, disable redirects and environment proxies, and resolve before use. Special-purpose metadata/link-local, multicast, unspecified, and reserved addresses are blocked. A saved LAN destination is explicit user approval. Secrets are not returned because authenticated provider profiles are not implemented.

Uploads are limited to 10 MB and PDF/DOCX/TXT. Parsers extract text only; macros and scripts are not executed. Page count and extracted length are bounded. Document instructions are untrusted prompt data. Audio is limited to 25 MB and decoded by FFmpeg without shell interpolation.

WebSockets require an existing session, have a narrow event allowlist, and do not execute arbitrary commands. Answer message IDs make retries idempotent. Model output is schema-validated and never executed. Logs should not contain document bodies or tokens.

Remaining hardening before any shared-network deployment: add local authentication, CSRF/origin enforcement beyond CORS, persisted hostname resolution pinning, request rate limits, and OS keychain-backed remote credentials.
