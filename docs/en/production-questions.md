# Questions and blockers before production

What to decide/finish before going live. Architecture — [documentation.md](./documentation.md).

---

## Open questions (decisions needed)

1. **Per-tenant encryption.** Does each OWN partner have their own MC Client Encryption Key
   (own fingerprint), or does the platform use one shared encryption key for everyone? This
   determines the scope of the per-tenant seam (see the blocker below).
2. **DB retention.** What retention window is required for `payment_idempotency` and
   `tx_status`, and what mechanism prunes old rows? There is no app-level TTL, both tables
   grow unbounded; `payment_idempotency.result` stores the full MC response (possibly PII).
3. **`X-Webhook-Token` delivery.** MC doesn't know the token — inject it at the ingress TLS
   layer, or set it as a custom header in the portal push config?

---

## Blockers before prod

- [ ] **Per-tenant encryption seam** (if OWN partners have different keys). FLE is currently
  platform-level — the interceptor encrypts with the key from `.env`. `OwnCredentialsProvider`
  already resolves per-tenant keys into `McCredentials`, but nobody uses them → an OWN
  partner's request encrypted with the platform key is rejected by MC (`082000`). To do: thread
  cert/fingerprint/privateKey from `McCredentials` into `EncryptionService` per-request (build
  and cache `JweEncryption` by fingerprint). The FLE mechanism itself is not a blocker (proven
  on sandbox, see "Decided"); the seam can be debugged there too.
- [ ] **`VaultSecretStore`** implemented + `MC_SECRET_STORE=vault` (currently a `NotImplemented`
  stub; the prod gate already requires `vault` and fails without it).
- [ ] **Strong secrets** instead of dev defaults: `MC_JWT_SECRET`, `MC_INTERNAL_TOKEN`,
  `MC_ADMIN_TOKEN`, `MC_WEBHOOK_TOKEN` (the prod gate checks this at startup).
- [ ] **mTLS for MC webhooks.** Push authenticity at MC is via mTLS, not a payload signature.
  At deploy: request the public mTLS cert from MC → add to the trust store; submit our cert
  chain via the KMP portal; confirm `X-Webhook-Token` delivery (question 3). Until then the
  active factor is the fail-closed `X-Webhook-Token`.
- [ ] **Decrypt encrypted push** (MTF/Prod). `WebhookHandler` detects `{ encrypted_payload }`
  and persists the envelope to `tx_status` (`eventType=ENCRYPTED`) before the ack, but does not
  decrypt it. To do: thread `decryptResponse` into the handler + the per-tenant seam (same
  item). On sandbox push is "Not Applicable" — the case can't be reproduced there.
- [ ] **OWN partner-id and keys** (including their decryption key) loaded into the secret manager.
- [ ] **`migration:run`** against the prod DB on deploy.

---

## Prod config checklist

- [ ] `TRUST_PROXY` = number of ingress hops (not `true`) — only for a correct `req.ip` behind a proxy.
- [ ] k8s liveness/readiness on `/health` and `/ready` (probes are ready).
- [ ] Tenant provisioning by the host: `platform` and its own — via the admin API
  (double-approval onboarding) or `SEED_DEMO=false npm run seed`. The module does not seed
  tenants on boot, otherwise PLATFORM mode won't work.
- [ ] Retention policy for `payment_idempotency`/`tx_status` (question 2).
- [ ] (Optional) Metrics/tracing (Prometheus `/metrics` / OpenTelemetry) + alerts. Logs
  (pino + correlation-id) are already in place.
- [ ] (Optional) Ingress rate-limit as defense-in-depth — the per-pod `@nestjs/throttler` is
  self-standing (correctness independent of the ingress).
- [x] `MC_ENCRYPTION_ENABLED=true` — FLE works in all environments, sandbox included.
- [x] Private Mastercard Encryption key to decrypt responses (`MC_DECRYPTION_KEY_PATH`) — present.

---

## Decided

- **TypeORM / embedding.** The service is one umbrella `MastercardModule`; the host provides
  the `DataSource` (our entities via `forFeature`/`autoLoadEntities`) and runs its own
  migrations; `DatabaseModule.forRoot` is only for the dev harness.
- **FLE mechanism** proven on sandbox: the request is encrypted with the Client Encryption
  Key, the response decrypted with our Mastercard Encryption private key (the keys used to be
  swapped → `082000`).
- Migration infrastructure, the RFI subsystem, and Swagger annotations — ready.

---

## Note: axios

`axios` is pinned to `1.6.0` (matches the host `b24club-api`; `@nestjs/axios@4` peer-requires
`^1.3.1` — no conflict). `npm audit` flags 1.x as HIGH (SSRF/ReDoS), but exposure is low (fixed
`baseURL`, our own relative paths, no client-supplied absolute URLs). The bump is driven by the
host (it owns the single axios in the monolith) — we follow in lockstep. Raw axios (not
`@nestjs/axios`) is deliberate, for interceptor control.
