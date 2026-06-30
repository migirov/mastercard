# Questions and blockers before production

What to decide/finish before going live. Architecture and the already-resolved design
decisions (FLE, per-tenant encryption, encrypted-push decryption, the AWS Secrets Manager
store, TypeORM embedding) live in [documentation.md](./documentation.md) and
[architecture.md](./architecture.md).

---

## Open questions (decisions needed)

1. **DB retention.** What retention window is required for `payment_idempotency` and
   `tx_status`, and what mechanism prunes old rows? There is no app-level TTL, both tables
   grow unbounded; `payment_idempotency.result` stores the full MC response (possibly PII).

---

## Blockers before prod (all deploy-time)

- [ ] **Strong secrets** instead of dev defaults: `MC_JWT_SECRET`, `MC_INTERNAL_TOKEN`,
  `MC_ADMIN_TOKEN`, `MC_WEBHOOK_TOKEN` (the prod gate checks this at startup).
- [ ] **In-app mTLS for MC webhooks (deploy wiring).** The auth decision is in the app
  (`WebhookAuthGuard` validates MC's client cert — implemented); the deploy steps:
  - bootstrap the app's HTTPS server with `requestCert: true, rejectUnauthorized: false` and the
    DigiCert **Outbound** chain (Assured ID Client CA G2 + Root G2) in `ca` (`TLS_*_PATH` envs);
  - set `webhookMtlsEnabled` + `webhookAllowedClientCNs` =
    `CrossborderServicesNotification-{env}.mastercard.com`;
  - run the ingress as **L4 TLS passthrough** (TLS terminated by the app, not the ingress);
  - submit our server cert chain via the KMP portal; confirm the webhook URL is FQDN/HTTPS (not IP).
- [ ] **OWN partner-id and keys** (including their decryption key) loaded into AWS Secrets
  Manager — one secret per partner, value = the `MerchantSecretBundle` JSON.
- [ ] **`migration:run`** against the prod DB on deploy.

---

## Prod config checklist

- [ ] **Live cross-tenant FLE validation** on sandbox with a 2nd real OWN key set before
  enabling FLE for OWN partners in prod (the per-tenant seam is already implemented — this
  only validates it against real keys).
- [ ] **Confirm push decryption on MTF**: a real encrypted push carries a `kid`; for OWN add a
  proactive resolution of the tenant key by `kid` for a cold cache (today an OWN push decrypts
  only if the key is already cached from API activity, otherwise it is durably persisted).
- [ ] `TRUST_PROXY` = number of ingress hops (not `true`) — only for a correct `req.ip` behind a proxy.
- [ ] k8s liveness/readiness on `/health` and `/ready` (probes are ready).
- [ ] Tenant provisioning by the host: `platform` and its own — via the admin API
  (double-approval onboarding) or `SEED_DEMO=false npm run seed`. The module does not seed
  tenants on boot, otherwise PLATFORM mode won't work.
- [ ] Retention policy for `payment_idempotency`/`tx_status` (question 1).
- [ ] (Optional) Metrics/tracing (Prometheus `/metrics` / OpenTelemetry) + alerts. Logs
  (pino + correlation-id) are already in place.
- [ ] (Optional) Ingress rate-limit as defense-in-depth — the per-pod `@nestjs/throttler` is
  self-standing (correctness independent of the ingress).

---

## Resolved (details in [architecture.md](./architecture.md) / [documentation.md](./documentation.md))

- **AWS Secrets Manager** secret store — `AwsSecretsManagerSecretStore`
  (`MC_SECRET_STORE=aws-secrets-manager`); `secretRef` = secret name/ARN, value = the
  `MerchantSecretBundle` JSON. (The former "Vault" naming was a vendor-TBD placeholder.)
- **Per-tenant encryption** — a per-tenant `JweEncryption` built from the partner PEM keys,
  cached by fingerprint; PLATFORM tenants use the shared key; incomplete OWN keys → fail-loud.
- **Encrypted-push decryption** — `kid` routing (PLATFORM / per-tenant); anything undecryptable
  is durably persisted to `tx_status` (ENCRYPTED) before the ack (no loss).
- **FLE** works in all environments incl. sandbox (`MC_ENCRYPTION_ENABLED=true`,
  `MC_DECRYPTION_KEY_PATH` present); request encrypted with the Client Encryption Key, response
  decrypted with the Mastercard Encryption private key.
- **Webhook authentication — in-app mTLS (no ingress dependency).** MC authenticates push only
  via a client certificate (no token/header/api-key — MC docs §"Push Notification Setup", so the
  "custom header in the portal" option is impossible). `WebhookAuthGuard` validates the cert
  in-app: trusted chain (`socket.authorized`) + subject-CN allowlist. `X-Webhook-Token` is an
  optional dev/secondary factor. The ingress is a dumb L4 passthrough; live confirmation on MTF.
- **TypeORM embedding** — one umbrella `MastercardModule`; the host owns the `DataSource` and
  runs its own migrations. Migration infrastructure, the RFI subsystem and Swagger — ready.

---

## Note: axios

`axios` is pinned to `1.6.0` (matches the host `b24club-api`; `@nestjs/axios@4` peer-requires
`^1.3.1` — no conflict). `npm audit` flags 1.x as HIGH (SSRF/ReDoS), but exposure is low (fixed
`baseURL`, our own relative paths, no client-supplied absolute URLs). The bump is driven by the
host (it owns the single axios in the monolith) — we follow in lockstep. Raw axios (not
`@nestjs/axios`) is deliberate, for interceptor control.
