# Backend Proxy Example

Reference server for the production API-key architecture described in the
main [README](../README.md#chave-de-api-da-anthropic-dev-vs-produção).

```
iPhone (app + keyboard extension)
        │  POST /v1/translate  { system, text }
        ▼
This server  (holds ANTHROPIC_API_KEY)
        │
        ▼
Anthropic API
        │
        ▼
This server ──► iPhone   { text }
```

The iOS client never sees `ANTHROPIC_API_KEY`. Point
`AppConfig.mode = .backendProxy(baseURL:)` at wherever you deploy this.

## Running locally

```bash
cp .env.example .env   # fill in ANTHROPIC_API_KEY
npm install
npm start
```

## What this does NOT do (add before real production use)

- **Real user authentication.** `APP_SHARED_SECRET` only stops anonymous
  internet traffic from hitting your Anthropic bill; it does not identify
  individual users. Add Sign in with Apple (or similar) plus signed,
  per-user tokens before shipping broadly.
- **Per-user quotas/billing.** The IP-based rate limit is a coarse abuse
  guard, not a fairness mechanism.
- **Persistence/observability beyond health checks.** By design — message
  content is never logged or stored here, matching the app's privacy policy.
  Add metrics on request counts/latency/error rates (not content) as needed.
- **TLS termination.** Deploy behind a platform that provides HTTPS
  (Render, Fly.io, Cloud Run, etc.) or terminate TLS yourself; never expose
  this over plain HTTP.
