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

**Why this is a blocker for OWN.** Each OWN partner has their own MC project →
their own Client Encryption Key (their own fingerprint). Encrypting their request
with the platform key makes Mastercard reject the payload (`082000 Crypto Key`).

> **Important (2026-06-16): the FLE mechanism itself is NO LONGER a blocker.**
> Platform field-level encryption is **proven live on sandbox** — the request is
> encrypted with the Client Encryption Key, the response is decrypted with our
> Mastercard Encryption private key, and the validation APIs return real data (live
> e2e 23/23). The old belief "sandbox doesn't support FLE" was wrong — we were
> encrypting with the wrong key (Mastercard Encryption instead of Client Encryption
> → `082000`). So the per-tenant seam can now be built and debugged **right on
> sandbox**, no waiting for MTF; the only open item is wiring the per-tenant keys
> themselves (needs a 2nd OWN key set, and the JWE lib needs file paths, not PEM
> strings).

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
- [x] **Private Mastercard Encryption key** to decrypt responses
      (`MC_DECRYPTION_KEY_PATH`) — we have it (our `fintory-decrypt`, fingerprint `75ea7e15…`,
      activated on the MC portal). OWN partners will need their own.
- [x] **`MC_ENCRYPTION_ENABLED=true`** — FLE works in all environments, sandbox included
      (verified 2026-06-16); enable as soon as keys are configured (not only MTF/Prod).
- [ ] **`MC_SECRET_STORE=vault`** + an implemented `VaultSecretStore` (currently a
      `NotImplemented` stub). The prod gate in `main.ts` already requires `vault` and fails without it.
- [ ] **Strong secrets** instead of dev defaults: `MC_JWT_SECRET`, `MC_INTERNAL_TOKEN`,
      `MC_ADMIN_TOKEN`, `MC_WEBHOOK_TOKEN` (mandatory — the webhook guard is fail-closed).
      The prod gate checks this at startup.
- [ ] **`TRUST_PROXY`** = number of ingress hops (not `true`) — only for deriving a correct `req.ip` behind a proxy (used by the rate-limit IP fallback); not related to authentication.
- [ ] **mTLS for Mastercard webhooks (authoritative push-notification authenticity).** Per the MC docs, webhook authenticity is provided by **mTLS**, NOT a payload signature (MC has no JWS/HMAC payload signature; the former "question C1" is closed by reading the docs). Do at deployment: (1) request the public mTLS push-notification cert from the MC representative; (2) add it to the receiving app's/ingress trust store; (3) submit our server cert chain via the KMP portal; (4) confirm with MC how `X-Webhook-Token` is delivered (MC doesn't know it — inject at the TLS layer or a custom header in the portal push config). Until then the active factor is the in-service fail-closed `X-Webhook-Token`. MC quote and details — `api.md` → Webhooks. There is no in-code payload-signature check (the noop verifier scaffold was removed in issue #7 — MC does not sign push bodies).
- [ ] **Decrypt encrypted push notifications (MTF/Prod).** The `WebhookHandler` currently detects
      an encrypted body (`{ encrypted_payload: { data } }`) and acks `200` WITHOUT processing (in
      sandbox push is "Not Applicable", so the case itself can't be tested on sandbox). The
      decryption key (`MC_DECRYPTION_KEY_PATH`) already exists and is proven on validation
      responses — what's left is threading `decryptResponse` into the push handler + the per-tenant
      seam (the same per-tenant item as in `EncryptionService`). Until then encrypted status events
      are not persisted to `tx_status`.
- [ ] **Optional ingress rate-limit** as defense-in-depth — the authoritative limit is the in-service self-standing per-pod `@nestjs/throttler` (correctness independent of the ingress); an ingress limit, if any, is not authoritative.
- [ ] **Personal partner-id and keys** of OWN partners loaded into the secret manager.
- [x] **DB migrations** — infrastructure is ready (`data-source.ts`, npm scripts
      `migration:generate/run/revert`, the single `InitialSchema` migration (creates the
      `tx_status` table for push-status persistence AND `payment_idempotency`), `synchronize`
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
- **DB retention (open item, infra).** After issue #4 the TTL'd KV layer is gone — payment
  idempotency (`payment_idempotency`) and webhook dedup/persistence (`tx_status`) live in Postgres
  with **no app-level TTL** (the cron cleanup was removed per the team lead). Implications: (1) both
  tables grow unbounded — especially `tx_status` from frequent non-status pushes (Carded Rate); (2)
  `payment_idempotency.result` stores the full MC response (possibly PII) permanently — the KV layer
  used to expire it after 24h. **Needs a host/infra decision:** a retention policy (partition by
  `receivedAt` / periodic prune of old rows), particularly for data minimization (PII/PCI). Payment
  idempotency is practically only needed within the retry window (minutes–a day), so pruning old
  `done` rows is safe. Question for the client: required retention window and mechanism.
- **Tenant provisioning on embedding (issue #5).** The embeddable `MastercardModule` no longer
  creates tenants on boot (`TenantRegistry` is a pure data layer; `platform` is seeded only by the
  dev harness). The host MUST provision tenants itself: the baseline `platform` and its own — via
  the admin API (double-approval onboarding) or `SEED_DEMO=false npm run seed` at provisioning time.
  Otherwise PLATFORM mode won't work (no PLATFORM tenant exists).
- ~~Expand Swagger annotations~~ — **done** during the code-quality review.

---

## Audit history (fixed)

A **10-round audit** (bugs / security / optimization) + **2 regression rounds** (each
round = audit→fix, all verified). **No open HIGH/MED issues.** Then a 4-perspective
code-quality review (architecture / maintainability / API contract / testing) → "Tier
1" refactors landed (centralized MC path map; a composed `UseGatewayContract()`
decorator; barrel `src/index.ts`; Swagger gaps filled; +4 regression specs). Tests:
20 suites / 147 unit tests + 23/23 e2e against the live sandbox (on live Postgres).

The earlier 4-cycle bug audit (2026-06-10), all fixes passed typecheck:
1. Tenant-seeding race when many pods start → `INSERT … ON CONFLICT DO NOTHING`.
2. Default `MC_WEBHOOK_TOKEN` passed the prod gate → added to `assertProdSecrets`.
3. Long `Idempotency-Key` overflowed `kv_store.key` (varchar 256) → validation (≤128).
4. Prod silently used dev `LocalSecretStore` → the prod gate now requires `vault`.
