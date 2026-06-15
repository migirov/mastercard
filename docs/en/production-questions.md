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
Key`). In sandbox, encryption is off (`MC_ENCRYPTION_ENABLED=false`, FLE off), so it
does not fire yet — this is an **external blocker**: it cannot be implemented or
verified without MTF access and real per-tenant keys (the JWE lib needs file paths,
not PEM strings).

**Question for the client/architecture.**
- Does each OWN partner really have **their own** MC Encryption Key, or does the
  platform use one shared encryption key for everyone? The fix scope depends on this.

**What to do (if per-tenant).** Thread the keys from `McCredentials` into encryption:
`EncryptionService` should accept cert/fingerprint/privateKey per-request (not from a
global config), or build `JweEncryption` on the fly from `creds`. Then the
`MastercardClient` interceptor passes `creds` into both encryption and signing. Cache
the built `JweEncryption` by fingerprint (rebuilding is expensive).

---

## ✅ Decided: TypeORM / embedding

The service is **ONE umbrella module (`MastercardModule`)** embedded into the host
monolith `b24club-api`. The **host** provides the TypeORM `DataSource` (our entities
via `forFeature` / `autoLoadEntities`) and runs **its own migrations** (not
`synchronize`). Our own `DatabaseModule.forRoot` + `DATABASE_URL` remain only for the
standalone dev-harness (`main.ts`). Question closed.

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
- [ ] **mTLS for Mastercard webhooks (authoritative push-notification authenticity).** Per the MC docs, webhook authenticity is provided by **mTLS**, NOT a payload signature (MC has no JWS/HMAC payload signature; the former "question C1" is closed by reading the docs). Do at deployment: (1) request the public mTLS push-notification cert from the MC representative; (2) add it to the receiving app's/ingress trust store; (3) submit our server cert chain via the KMP portal; (4) confirm with MC how `X-Webhook-Token` is delivered (MC doesn't know it — inject at the TLS layer or a custom header in the portal push config). Until then the active factor is the in-service fail-closed `X-Webhook-Token`. MC quote and details — `api.md` → Webhooks. `WebhookSignatureVerifier` stays a scaffold (Noop) in case MC ever adds a payload signature.
- [ ] **Optional ingress rate-limit** as defense-in-depth — the authoritative limit is the in-service self-standing per-pod `@nestjs/throttler` (correctness independent of the ingress); an ingress limit, if any, is not authoritative.
- [ ] **Personal partner-id and keys** of OWN partners loaded into the secret manager.
- [x] **DB migrations** — infrastructure is ready (`data-source.ts`, npm scripts
      `migration:generate/run/revert`, initial `InitialSchema`, `synchronize`
      off in prod). Remaining: run `migration:run` against the prod DB on deploy.

---

## Dependency note: axios

`axios` is pinned to **1.6.0** — this **exactly matches** the host `b24club-api`
(their `package.json` also pins `axios 1.6.0`), and `@nestjs/axios@4` (which the host
uses) peer-requires `axios ^1.3.1` → no conflict. However `npm audit` flags axios
1.0.0–1.15.2 with HIGH advisories (SSRF / prototype-pollution / ReDoS); latest is
1.17.0. Our practical exposure is low (fixed `baseURL`, relative paths we build
ourselves, no client-supplied absolute URLs, no proxy trust). **Recommendation:** the
axios bump should be driven by the **host** (it owns the single deduped axios in the
monolith); we follow in lockstep. We use raw axios (not `@nestjs/axios`) deliberately
for interceptor control.

---

## Business-driven enhancements (not blockers)

- ~~RFI subsystem~~ — **implemented** (retrieve / update / upload / download).
- Observability: **logs are ready** (structured JSON pino + correlation-id);
  remaining are **metrics/tracing** (Prometheus `/metrics` or OpenTelemetry) + alerts.
- **Health probes are ready** (`/health`, `/ready`) — wire liveness/readiness in the k8s manifest.
- ~~Cleanup of expired `kv_store`~~ — **done**: `KvCleanupService` (`@Cron` hourly,
  `@nestjs/schedule`) removes expired entries.
- ~~Expand Swagger annotations~~ — **done** during the code-quality review.

---

## Audit history (fixed)

A **10-round audit** (bugs / security / optimization) + **2 regression rounds** (each
round = audit→fix, all verified). **No open HIGH/MED issues.** Then a 4-perspective
code-quality review (architecture / maintainability / API contract / testing) → "Tier
1" refactors landed (centralized MC path map; a composed `UseGatewayContract()`
decorator; barrel `src/index.ts`; Swagger gaps filled; +4 regression specs). Tests:
16 suites / 112 unit tests + 23/23 e2e against the live sandbox (on live Postgres).

The earlier 4-cycle bug audit (2026-06-10), all fixes passed typecheck:
1. Tenant-seeding race when many pods start → `INSERT … ON CONFLICT DO NOTHING`.
2. Default `MC_WEBHOOK_TOKEN` passed the prod gate → added to `assertProdSecrets`.
3. Long `Idempotency-Key` overflowed `kv_store.key` (varchar 256) → validation (≤128).
4. Prod silently used dev `LocalSecretStore` → the prod gate now requires `vault`.
