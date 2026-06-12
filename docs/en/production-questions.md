# Questions and blockers before production

What needs to be decided/finished before going live. Complements [memory.md](./memory.md)
(status) and [documentation.md](./documentation.md) (architecture).

---

## 🔴 BLOCKER: per-tenant encryption is not wired

**Summary.** Field-level encryption (JWE) is currently **platform-level**: the
interceptor encrypts the request with the key from `.env`
(`MC_ENCRYPTION_CERT_PATH` / `MC_ENCRYPTION_FINGERPRINT` / `MC_DECRYPTION_KEY_PATH`)
through a single `EncryptionService`. Meanwhile `CredentialsService.fetchOwn` already
resolves **per-tenant** encryption keys (`encryptionCertPem`,
`encryptionFingerprint`, `decryptionKeyPem`) into `McCredentials` — but **nobody
uses them**.

**Why this is a blocker for OWN + MTF/Prod.** Each OWN partner has their own MC
project → their own Mastercard Encryption Key (their own fingerprint). Encrypting
their request with the platform key makes Mastercard reject the payload (`Crypto
Key`). In sandbox, encryption is off (`MC_ENCRYPTION_ENABLED=false`), so it does not
fire yet.

**Question for the client/architecture.**
- Does each OWN partner really have **their own** MC Encryption Key, or does the
  platform use one shared encryption key for everyone? The fix scope depends on this.

**What to do (if per-tenant).** Thread the keys from `McCredentials` into encryption:
`EncryptionService` should accept cert/fingerprint/privateKey per-request (not from a
global config), or build `JweEncryption` on the fly from `creds`. Then the
`MastercardClient` interceptor passes `creds` into both encryption and signing. Cache
the built `JweEncryption` by fingerprint (rebuilding is expensive).

---

## 🟠 Open architectural question: TypeORM

Is our service **standalone** or **part of the `b24club-api` monolith**?
- Standalone → the current setup is correct: own `DatabaseModule.forRoot` +
  `DATABASE_URL`, `synchronize` in dev.
- Part of the monolith → drop our `forRoot`, register entities via `forFeature` in
  their `DataSource`, manage the schema with their migrations (not `synchronize`).

**Awaiting an answer** — it affects DB config and deployment.

---

## Prod prerequisites (checklist)

- [ ] **Per-tenant encryption** (see the blocker above) — if OWN partners have different keys.
- [ ] **Private Client Encryption key** to decrypt responses in MTF/Prod
      (`MC_DECRYPTION_KEY_PATH`) — currently only the public cert exists.
- [ ] **`MC_ENCRYPTION_ENABLED=true`** in MTF/Prod (stays `false` in sandbox).
- [ ] **`MC_SECRET_STORE=vault`** + an implemented `VaultSecretStore` (currently a
      `NotImplemented` stub). The prod gate in `main.ts` already requires `vault` and fails without it.
- [ ] **Strong secrets** instead of dev defaults: `MC_JWT_SECRET`, `MC_INTERNAL_TOKEN`,
      `MC_ADMIN_TOKEN`, `MC_WEBHOOK_TOKEN` (mandatory — the webhook guard is fail-closed).
      The prod gate checks this at startup.
- [ ] **`TRUST_PROXY`** = number of ingress hops (not `true`) — only for deriving a correct `req.ip` behind a proxy (used by the rate-limit IP fallback); not related to authentication.
- [ ] **mTLS at the ingress** for Mastercard webhooks — optional, additional network layer; not the authentication. Authentication is the in-service fail-closed token (`X-Webhook-Token`); JWS/HMAC signature verification is the planned authoritative factor (pending MC spec, C1).
- [ ] **Optional ingress rate-limit** as defense-in-depth — the authoritative limit is the in-service self-standing per-pod `@nestjs/throttler` (correctness independent of the ingress); an ingress limit, if any, is not authoritative.
- [ ] **Personal partner-id and keys** of OWN partners loaded into the secret manager.
- [x] **DB migrations** — infrastructure is ready (`data-source.ts`, npm scripts
      `migration:generate/run/revert`, initial `InitialSchema`, `synchronize`
      off in prod). Remaining: run `migration:run` against the prod DB on deploy.

---

## Business-driven enhancements (not blockers)

- RFI subsystem (requests for information / documents).
- Observability: **logs are ready** (structured JSON pino + correlation-id);
  remaining are **metrics/tracing** (Prometheus `/metrics` or OpenTelemetry) + alerts.
- **Health probes are ready** (`/health`, `/ready`) — wire liveness/readiness in the k8s manifest.
- ~~Cleanup of expired `kv_store`~~ — **done**: `KvCleanupService` (`@Cron` hourly,
  `@nestjs/schedule`) removes expired entries.
- Expand Swagger annotations for merchants.

---

## Bug-audit history (fixed)

A 4-cycle bug audit (2026-06-10), all fixes passed typecheck:
1. Tenant-seeding race when many pods start → `INSERT … ON CONFLICT DO NOTHING`.
2. Default `MC_WEBHOOK_TOKEN` passed the prod gate → added to `assertProdSecrets`.
3. Long `Idempotency-Key` overflowed `kv_store.key` (varchar 256) → validation (≤128).
4. Prod silently used dev `LocalSecretStore` → the prod gate now requires `vault`.
