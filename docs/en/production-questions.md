# Questions and blockers before production

What to decide/finish before going live. Architecture — [documentation.md](./documentation.md).

---

## Open questions (decisions needed)

1. **DB retention.** What retention window is required for `payment_idempotency` and
   `tx_status`, and what mechanism prunes old rows? There is no app-level TTL, both tables
   grow unbounded; `payment_idempotency.result` stores the full MC response (possibly PII).
2. **`X-Webhook-Token` delivery.** MC doesn't know the token — inject it at the ingress TLS
   layer, or set it as a custom header in the portal push config?

---

## Blockers before prod

- [ ] **Strong secrets** instead of dev defaults: `MC_JWT_SECRET`, `MC_INTERNAL_TOKEN`,
  `MC_ADMIN_TOKEN`, `MC_WEBHOOK_TOKEN` (the prod gate checks this at startup).
- [ ] **mTLS for MC webhooks.** Push authenticity at MC is via mTLS, not a payload signature.
  At deploy: request the public mTLS cert from MC → add to the trust store; submit our cert
  chain via the KMP portal; confirm `X-Webhook-Token` delivery (question 2). Until then the
  active factor is the fail-closed `X-Webhook-Token`.
- [ ] **OWN partner-id and keys** (including their decryption key) loaded into AWS Secrets
  Manager (one secret per partner, value = the `MerchantSecretBundle` JSON; see "Decided").
- [ ] **`migration:run`** against the prod DB on deploy.

---

## Prod config checklist

- [ ] **Live cross-tenant FLE validation** on sandbox with a 2nd real OWN key set before
  enabling FLE for OWN partners in prod (the seam itself is implemented — see "Decided").
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
- [x] `MC_ENCRYPTION_ENABLED=true` — FLE works in all environments, sandbox included.
- [x] Private Mastercard Encryption key to decrypt responses (`MC_DECRYPTION_KEY_PATH`) — present.

---

## Decided

- **Secret store — AWS Secrets Manager (implemented).** The host b24club-api runs on AWS,
  so the prod `SecretStore` is `AwsSecretsManagerSecretStore` (`@aws-sdk/client-secrets-manager`,
  pinned to the host's `^3.975.0`). A tenant's `secretRef` is the secret name or ARN; the
  secret value is a JSON `MerchantSecretBundle` (`.p12` keys as base64). Region/credentials come
  from the standard AWS chain (the IAM role on ECS/EKS — same as the host's S3/Cognito), with an
  optional `MC_SECRET_STORE_REGION` override. Select it with `MC_SECRET_STORE=aws-secrets-manager`
  (the prod gate requires exactly this). Caching stays upstream (cache-manager TTL+LRU). The
  former "Vault" naming was a vendor-TBD placeholder, never a HashiCorp commitment.
- **Per-tenant encryption — implemented.** Each OWN partner has its own key; `EncryptionService`
  builds a per-tenant `JweEncryption` from the partner's PEM keys (`encryptionCertPem` /
  `decryptionKeyPem`, `useCertificateContent` mode), cached by fingerprint; PLATFORM tenants use
  the shared key from config. The `MastercardClient` interceptor was unchanged (it already passes
  `creds`). Incomplete OWN keys with FLE on → fail-loud. Remaining: live cross-tenant validation
  with real keys (see the checklist).
- **Encrypted push decryption — implemented (kid routing).** `WebhookHandler` decrypts the
  envelope by the `kid` in the cleartext JWE JOSE header (per the MC docs, MC sets `kid` to the
  fingerprint of the decryption key): PLATFORM → the platform key; OWN → the per-tenant key by
  `kid` if already built (cached from that tenant's API activity). Decrypted events are processed
  like any other; anything that can't be decrypted (no key for the `kid` / FLE off / failure) is
  durably persisted to `tx_status` (ENCRYPTED) before the ack for reprocessing (no loss).
  Remaining: MTF confirmation and a proactive OWN-key resolution by `kid` for a cold cache (see
  the checklist).
- **TypeORM / embedding.** The service is one umbrella `MastercardModule`; the host provides
  the `DataSource` (our entities via `forFeature`/`autoLoadEntities`) and runs its own
  migrations; `DatabaseModule.forRoot` is only for the dev harness.
- **FLE mechanism** proven on sandbox: the request is encrypted with the Client Encryption
  Key, the response decrypted with the Mastercard Encryption private key (the keys used to be
  swapped → `082000`).
- Migration infrastructure, the RFI subsystem, and Swagger annotations — ready.

---

## Note: axios

`axios` is pinned to `1.6.0` (matches the host `b24club-api`; `@nestjs/axios@4` peer-requires
`^1.3.1` — no conflict). `npm audit` flags 1.x as HIGH (SSRF/ReDoS), but exposure is low (fixed
`baseURL`, our own relative paths, no client-supplied absolute URLs). The bump is driven by the
host (it owns the single axios in the monolith) — we follow in lockstep. Raw axios (not
`@nestjs/axios`) is deliberate, for interceptor control.
