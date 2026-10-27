# Remote Ollama

Use a remote endpoint only when you control or trust its network path.

1. Ensure Ollama listens on the intended private interface and firewall rules restrict clients.
2. Prefer WireGuard, Tailscale, SSH forwarding, or another private tunnel.
3. Add the exact base URL in Settings. Do not include `/api`, credentials, query strings, or fragments.
4. Test connectivity and confirm the expected model appears before an interview.

The backend disables proxy-environment inheritance and redirects, resolves destinations immediately before requests, and blocks link-local metadata, multicast, unspecified, and reserved addresses. Private/loopback addresses are allowed only after the user explicitly saves a profile. The app does not turn arbitrary browser URLs into a proxy.

Ollama's server must permit the backend host. An unavailable remote profile never prevents startup; choose offline mode or another profile. Authentication headers are not stored in this release. Put authentication at a private tunnel/reverse proxy and never embed secrets in a URL.
