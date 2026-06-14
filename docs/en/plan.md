# Work plan — Mastercard Cross-Border Gateway

Multi-merchant gateway (NestJS 10) to Mastercard Cross-Border Services.
**Embedded as ONE umbrella module (`MastercardModule`) into the host monolith
`b24club-api`**; also runs standalone via the `main.ts` dev-harness.
Architecture — in [architecture.md](./architecture.md), entities — in
[documentation.md](./documentation.md), blockers — in
[production-questions.md](./production-questions.md). This file is the plan and status.

Legend: ✅ done · 🔄 in progress · ⬜ not started · 🟡 awaiting external

---

## Decisions made

- **Embedding (decided):** the service is **ONE umbrella module (`MastercardModule`)**
  embedded into the host monolith `b24club-api`. The **host** provides the TypeORM
  `DataSource` (our entities via `forFeature` / `autoLoadEntities`) and runs its own
  migrations (not `synchronize`). Standalone via `main.ts` is the dev-harness only.
- **Merchant model (confirmed by the client):** the PRIMARY scenario — **a separate
  `partner-id` per partner** (`OWN` mode). Each partner is already registered with
  Mastercard, has their own keys, and serves their own business clients through our
  platform. Separation is native via `partner-id` in the URL path; **there is NO
  `merchant`/sub-account field in the Cross-Border API**. `PLATFORM` (shared
  partner-id) — a secondary concept we keep.
- **Credentials — two modes:** `OWN` (primary) and `PLATFORM`.
- **Consumption — both:** external REST API (OAuth2) and internal (service token).
- **Secrets — Secret Manager (Vault/KMS).** Vendor-agnostic implementation.
- **Access — gating:** transactions only for approved partners (Mastercard + platform).
- **Encryption — MANDATORY** in MTF/Prod (the entire quote/payment payload — JWE).
- **Storage — PostgreSQL** (resilient, consistent across pods). **Redis and in-memory
  as storage — removed.** Deployment — Docker/Kubernetes, **many pods**.
- **Idempotency-Key — KEPT** (client confirmed; backstop — MC `transaction_reference`).
- **Dependency versions — aligned with the client's `b24club-api`** (Nest 10, jwt
  10.1.1, throttler ^5, swagger 7.3.0, typeorm 0.3.20, reflect-metadata 0.1.x).
- **Stack:** NestJS (Node 22), TypeORM + PostgreSQL, `mastercard-oauth1-signer`,
  `mastercard-client-encryption`, `node-forge`.

---

## Phase 1 — Tenant + per-tenant signing (core) ✅

- ✅ `Tenant` model and registry (`src/tenants/`), lifecycle statuses.
  *(Initially in-memory; later migrated to PostgreSQL — see below.)*
- ✅ `CredentialsService.resolve(tenant)` — `PLATFORM` mode.
- ✅ Stateless `MastercardClient.request(creds, …)` — signed with the tenant's key on
  every request (one instance for any number of merchants).
- ✅ Cross-border layer (`balances` / `rates` / `quotes`) + gating by `ACTIVE`.

**Phase 1 audit (8 fixes):** baseUrl normalization (signature mismatch on trailing
`/`); unwrapping the MC response with error mapping (don't leak 401/403/5xx/HTML);
network errors → 502; keep-alive; `encodeURIComponent` for partnerId; `secretRef`
sanitization; string-body passthrough.

## Phase 2 — Vault/KMS + OWN mode ✅

- ✅ `SecretStore` abstraction (`src/secrets/`): `getMerchantSecrets(secretRef)`.
- ✅ `LocalSecretStore` (dev: `secrets.local.json` + sandbox seed from `.env`).
- ✅ `VaultSecretStore` — vendor stub, selected via `MC_SECRET_STORE`.
- ✅ `OWN` mode: bundle → `McCredentials`, per-tenant cache with TTL + `invalidate()`.
- ✅ Keys: `p12Path` (dev) and `p12Base64` (as from Vault).

**Phase 2 audit (5 fixes):** cache-stampede dedup (cached Promise); evict-on-reject;
partnerId presence check; `safePartnerId` against path-injection; bundle validation.

**General audit (5 fixes):** demo seed/test tenants off in `production`; helmet +
256kb body limit + graceful shutdown; bounded keep-alive socket pool.

## Phase 3 — Auth + approval workflow ✅

- ✅ External authorization — **OAuth2 client credentials**: `POST /oauth/token`
  (client_id/secret → JWT, TTL 15 min), client registry (hashed secret, timing-safe).
- ✅ `TenantAuthGuard` — Bearer JWT (external) **or** `X-Internal-Token` +
  `X-Tenant-Id` (internal). Single `TenantContext` (`@CurrentTenant`).
- ✅ Approval model: 2 flags (`platformApproved`/`mcApproved`) + `suspended`;
  **ACTIVE is computed**. Cross-border gating on `isActive`.
- ✅ Admin API (`X-Admin-Token`): create a partner, approvals, suspend/unsuspend,
  issue/revoke OAuth clients.
- ✅ Audit (5 fixes): HS256 pinning sign+verify, issuer check, refuse to start in
  production with weak secrets, token hash comparison, timing-safe client_id.
- ✅ **Rate-limit** (`@nestjs/throttler`): crossborder 120/min by tenantId,
  `/oauth/token` 10/min by client_id, admin 120/min. *(Improved later — see below.)*
- ✅ MC **webhook** scaffold (`POST /webhooks/mastercard`): dedup by `eventRef`,
  always 200. **Authentication = in-service fail-closed token (`X-Webhook-Token`),
  required in prod and dev**; JWS/HMAC signature verification is the planned
  authoritative factor (pending MC spec, C1). mTLS at the ingress is optional,
  additional — not the authentication.

## Phase 4 — JWE field-level encryption ✅ (sandbox plain; ready for MTF/Prod)

- ✅ **PoC**: JWE via `mastercard-client-encryption` correct per the docs
  (`{encrypted_payload:{data}}`, `alg:RSA-OAEP-256/enc:A256GCM/cty/kid`); the
  signature over the encrypted body was accepted by sandbox.
- ✅ Fix: `loadPrivateKeyFromP12` → forge non-strict mode (like the official MC lib).
- ✅ Key model figured out: **Client Encryption Key** (ours, decrypts RESPONSES) and
  **Mastercard Encryption Key** `fintory1` (encrypts REQUESTS). Cert extracted →
  `certs/mastercard-encryption-cert.pem`; `kid` = public-key fingerprint `cec428ec…478cf1`.
- ✅ **Key finding:** sandbox **does NOT support FLE** — plain quote → **200 with a
  real proposal**, encrypted → `Crypto Key/082000`. Encryption — MTF/Prod only.
- ✅ `EncryptionService` (`src/encryption/`) with a **toggle** `MC_ENCRYPTION_ENABLED`.
  *(Initially called from `CrossBorderService`; later moved into the axios interceptor — see below.)*
- ✅ Verified end-to-end: `POST /crossborder/quotes` (sandbox/plain) → **HTTP 201**.
- 🟡 For MTF/Prod: enable the toggle + the private Client key in `MC_DECRYPTION_KEY_PATH`
  (not available yet — a question for the portal).
- ✅ Phase 4 audit (3 fixes): decryption in try/catch (→502); header order; decryption
  of forwardable errors. Limitation: `EncryptionService` is platform-level (per-tenant
  is an open blocker, see below).

## Phase 5 — Reliability ✅ (core)

- ✅ **KV store** (`src/store/`) — `PostgresKvStore` (consistent across pods).
  *(Initially in-memory/Redis; moved to Postgres — see below.)*
- ✅ **Payment idempotency** (`IdempotencyService`): `Idempotency-Key` on
  `POST /crossborder/payments` → same result without calling MC again; a lock against
  races (atomic `setIfAbsent`), errors not cached, isolation by tenant.
- ✅ **Audit trail** (**per-controller** `AuditInterceptor` + `AuditService` → Postgres):
  who/source/method/path/status/ms per request (no bodies/secrets); `GET /admin/audit`.
  *(No global `APP_*` — each controller declares its own cross-cutting layers.)*
- ✅ **Webhook dedup** via `KvStore` (Postgres).
- ✅ Phase 5 audit (5 fixes): short idempotency lock TTL (120s) + long result TTL
  (24h); Swagger off in production (`SWAGGER_ENABLED`); graceful shutdown.
  *(Redis-specific fixes are obsolete after the Postgres migration.)*
- ⬜ Observability (metrics/tracing) — optional.

## Swagger ✅

- ✅ `@nestjs/swagger` at `/api-docs` (auth schemes: merchant / internal / admin).
  Disabled in production without `SWAGGER_ENABLED`.

## Phase 6 — Completeness ✅ (MC API coverage — COMPLETE)

- ✅ Operations **payment / retrieve(by-id, by-ref) / cancel / quote-confirmation /
  balance**. Endpoints under `/crossborder/`. Verified: they reach MC.
- ✅ Phase 6 audit (fix): `assertSafeId` — paymentId cannot change the URL structure.
- ✅ DTO validation: **there is NO global `ValidationPipe`** — each controller
  declares its own pipe (strict for admin/oauth, `mcPassthrough` for bodies forwarded
  to MC). Quote/payment MC bodies are left untouched by the pipe (→201).

### Full MC API Reference coverage ✅

**All 15 groups** of the MC API Reference are implemented (14 fully + #15 Push
Notifications partial). On top of the quote/payment/retrieve/cancel/confirm/balance
core, the following were added and live-tested as the gateway contract:
- ✅ **Address Validation**.
- ✅ **Account Validation** (account-validations + bank-lookups + iban-generations).
- ✅ **Cash Pickup** (4 GET catalogs — work live on sandbox).
- ✅ **Endpoint Guide** (GET).
- ✅ **RFI** (retrieve / update / upload / download).
- ✅ **Carded Rate Pull**.
- ✅ **#15 Push Notifications** — webhook receiver done; cryptographic signature
  awaits the MC spec (question C1).

**Sandbox caveats:** validation POSTs need JWE encryption (FLE is off on sandbox → only
the gateway contract is verifiable, the body auto-encrypts in MTF/Prod); endpoint-guide
reaches MC but sandbox returns an HTML-500 for the generic partner-id; RFI sandbox
canned-rejects a non-onboarded partner-id; Carded Rate has no sandbox.

- ✅ Swagger annotations filled in (gaps closed during the code-quality review, see below).

---

## Enhancements after phases 1–6

### Migration to PostgreSQL ✅

- ✅ Redis and in-memory **removed as storage**; persistence — PostgreSQL + TypeORM
  (`src/database/`): entities `tenants`, `oauth_clients`, `audit_log`, `kv_store`.
  `TenantRegistry`/`ClientRegistry`/`AuditService` → repositories; `KvStore` →
  `PostgresKvStore` (atomic `setIfAbsent`).
- ✅ Tenant seeding — atomic `INSERT … ON CONFLICT DO NOTHING` (no races when many
  pods start at once).
- ✅ Rate-limit — self-standing per-pod `@nestjs/throttler` (correctness independent
  of the ingress; an ingress limit, if any, is optional defense-in-depth, not
  authoritative); credentials cache — in-memory per-pod (cache from Vault).
- ✅ `DATABASE_URL` + `DB_SYNC`; `docker-compose.yml` (Postgres 16).
- ✅ Typecheck OK; **e2e on a live Postgres has been run** (repeatedly, green) — now
  part of normal verification.

### Version alignment with the client ✅

- ✅ All dependencies aligned with `b24club-api` (legacy versions); no conflicts
  (typecheck + peer-check; one benign class-validator/mapped-types warning).

### Encryption → axios interceptor ✅

- ✅ Encryption (encrypt+sign) and decryption moved into the **axios interceptors** of
  `MastercardClient`; `CrossBorderService` became "clean" (knows nothing about crypto).
  `EncryptionService` is called from the interceptor. Documented (+ a note about
  possible extraction into a separate service and its downsides).

### Rate-limit hardening behind a proxy ✅

- ✅ `/oauth/token` — limit by **client_id** (`OAuthThrottlerGuard`): not bypassable
  by IP rotation behind an LB.
- ✅ `TenantThrottlerGuard` — strictly by `tenantId`, **fail-closed** (no context →
  error, not a shared `ip/'unknown'` bucket).
- ✅ `TRUST_PROXY` — guidance in `.env` (number of ingress hops, not `'true'`).

### Bug audit — 4 cycles ✅

All fixes passed typecheck:
1. Tenant-seeding race when many pods start → `ON CONFLICT DO NOTHING`.
2. Default `MC_WEBHOOK_TOKEN` passed the prod gate → added to `assertProdSecrets`.
3. Long `Idempotency-Key` overflowed `kv_store.key` (varchar 256) → validation.
4. Prod silently used dev `LocalSecretStore` → the prod gate now requires `vault`.

### Error localization ✅

- ✅ All exception messages and `throw new Error` translated to **English**
  (client-facing + crash logs). Comments and operational `Logger.*` are in Russian.

### Native Nest modules (off-the-shelf instead of hand-rolling) ✅

All verified live (boot + functionally):
- ✅ **`@nestjs/terminus`** — `/health` (liveness), `/ready` (readiness + DB ping)
  for k8s. Probes excluded from audit and pino autoLogging.
- ✅ **ENV validation** — `ConfigModule.forRoot({ validate })` (class-validator),
  fail-fast at startup instead of scattered lazy checks.
- ✅ **TypeORM migrations** — `data-source.ts`, scripts `migration:generate/run/revert`,
  initial `InitialSchema` (generated and run). `synchronize` off in prod.
- ✅ **`@nestjs/schedule`** — `KvCleanupService` (`@Cron` hourly) cleans expired `kv_store`.
- ✅ **`nestjs-pino`** — structured JSON log + correlation-id (`x-request-id`),
  redaction of secret headers; pino is the logger for the whole application.

### Hardening: 10 audit rounds + 2 regressions ✅

- ✅ A **10-round audit** (bugs / security / optimization) + **2 regression rounds**
  (each round = audit→fix, all verified). **No open HIGH/MED issues.**

### Code-quality review (4 perspectives) ✅

- ✅ Review across 4 perspectives (architecture / maintainability / API contract /
  testing) → "Tier 1" refactors landed: centralized MC path map; a composed
  cross-cutting decorator `UseGatewayContract()` (error filter + audit); public-api
  barrel `src/index.ts`; Swagger gaps filled; +4 new regression test specs.
  **Verdict: senior-level codebase, no rewrite needed.**

### Tests ✅

- ✅ Unit (jest): **16 suites / 112 tests** — green.
- ✅ E2E: **23/23** against the **live Mastercard sandbox** (`test/app.e2e-spec.ts`),
  including a run on live Postgres. Part of normal verification.

---

## Open questions / blockers

1. 🔴 **Per-tenant encryption** is not wired — the interceptor encrypts with the
   platform key; per-tenant `encryptionCertPem/fingerprint/decryptionKeyPem` are
   resolved into `McCredentials` but not threaded into `EncryptionService`. A blocker
   for OWN+MTF/Prod (partners have different MC keys). Known seam fix: pass `creds`
   into `encryptRequest/decryptResponse`. Cannot be implemented/verified without MTF
   access + real per-tenant keys. See [production-questions.md](./production-questions.md).
2. 🟡 **Webhook signature (C1):** real JWS/HMAC verification awaits Mastercard's
   signature spec; currently a Noop scaffold, the active factor is the token.
3. 🟡 **Private Client Encryption key** to decrypt responses in MTF/Prod
   (`MC_DECRYPTION_KEY_PATH`) — currently only the public cert (needs the portal).
4. 🟡 **Secret manager** — Vault / AWS / GCP? Only `VaultSecretStore` needs implementing.
5. ⬜ Observability (metrics/tracing) — optional.

> ✅ **Closed:** TypeORM question (decided — one umbrella module in the host monolith);
> e2e on Postgres (run); `kv_store` cleanup (`KvCleanupService`); RFI subsystem (implemented).

---

## How to run (Windows + project on a WSL UNC path)

`npm`/`node` are on Windows; a direct `npm run` from Git Bash fails on UNC paths.
Workaround via `pushd` (mounts the UNC onto a temporary drive):

```powershell
cmd /c "pushd \\wsl.localhost\Ubuntu\home\isaak\valeri\mastercard && <command> & popd"
```

**PostgreSQL is required.** In WSL:

```bash
cd ~/valeri/mastercard
docker compose up -d        # Postgres 16 (docker-compose.yml)
npx ts-node src/main.ts     # auto-schema (synchronize) + tenant seeds; port 3000
```

- `npm run ping [-- <tenantId>]` — smoke test through a tenant (platform/own-sandbox/own-demo).
- The tenant comes from **authentication** (Bearer JWT / `X-Internal-Token`+`X-Tenant-Id`),
  not from an `x-tenant-id` header.
- Endpoints: `POST /oauth/token`, `GET/POST /crossborder/*`, `…/admin/*`,
  `POST /webhooks/mastercard`, Swagger `GET /api-docs`.
```
