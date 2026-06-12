# Session Memory — Mastercard Cross-Border Gateway

A handoff document to restore context (if the conversation was compacted).
Complements [README.md](../../README.md) (entry point), [plan.md](./plan.md) (status
by phase), [architecture.md](./architecture.md) (design), [documentation.md](./documentation.md)
(entities), [api.md](./api.md) (endpoints), [tests.md](./tests.md) (test report),
[production-questions.md](./production-questions.md) (pre-prod blockers).

---

## What this project is

A standalone **multi-merchant gateway** to **Mastercard Cross-Border Services**
(NestJS, Node 22, PostgreSQL). The platform connects partners; each one reaches
Mastercard through us. Access — only for approved partners (Mastercard + platform).
Deployment — **Docker/Kubernetes, many pods**.

**Client requirement (confirmed):** the primary scenario — **a separate `partner-id`
per partner** (`OWN` mode): the partner is already registered with MC, has their own
keys, and serves their own business clients through the platform. `PLATFORM` (shared
partner-id) — secondary. **There is NO `merchant`/sub-account field in the
Cross-Border API** (verified against the docs) — separation is native via `partner-id`.

---

## Status (everything done, typecheck OK)

| Layer | Status |
|---|---|
| Tenant + per-tenant OAuth1 signing | ✅ |
| SecretStore (Local/Vault) + OWN mode | ✅ |
| Auth: OAuth2 client-creds, 2 guards, admin API, approval | ✅ |
| JWE encryption (env toggle, in an axios interceptor) | ✅ |
| Operations: quote/payment/retrieve/cancel/confirmation + DTO validation | ✅ |
| Reliability: idempotency, audit, rate-limit | ✅ |
| Swagger `/api-docs` | ✅ |
| **Storage → PostgreSQL (TypeORM)** | ✅ **e2e run on a live Postgres** |
| Versions aligned with the client's `b24club-api` | ✅ |
| **Pushed to git** (github.com/migirov/mastercard, public) | ✅ |

Every layer went through an **audit** — ~40 fixes total (per-phase + 4-cycle +
10-cycle, see below). Key achievement: the whole stack verified **live on sandbox** —
balances/rates/quote (201 with a real proposal), both auth paths, gating,
idempotency, webhook dedup, persistence after restart (see [tests.md](./tests.md)).

---

## Architecture (`src/` modules)

```
database/                  — infra ONLY: DatabaseModule (dev forRoot), data-source, migrations
                             (entities moved into their own modules — co-location, see below)
store/                     — KvStore → PostgresKvStore (idempotency + webhook dedup, TTL)
tenants/                   — TenantRegistry over a Postgres repository (async) + seeds
credentials/               — CredentialsService.resolve(tenant): PLATFORM|OWN, in-mem CACHE
secrets/                   — SecretStore: LocalSecretStore | VaultSecretStore (stub)
auth/                      — OAuth2 (token endpoint, ClientRegistry→Postgres), guards, @CurrentTenant
admin/                     — onboarding partners, approvals, issuing keys, GET /admin/audit
encryption/                — EncryptionService (JWE, toggle MC_ENCRYPTION_ENABLED)
idempotency/               — IdempotencyService (by Idempotency-Key, via KvStore→Postgres)
audit/                     — AuditInterceptor (global) + AuditService→Postgres
webhooks/                  — POST /webhooks/mastercard (dedup by eventRef via KvStore)
mastercard/                — MastercardClient: axios interceptors (encrypt+sign / decrypt)
crossborder/               — business operations + controller (CLEAN, no crypto)
common/                    — p12.util, crypto.util, tenant-throttler.guard
```

**Encryption** is moved into the **axios interceptor** of `MastercardClient` (request:
encrypt→sign over the encrypted body; response: decrypt). `CrossBorderService` knows
nothing about crypto. Details and "can it be extracted into a separate service +
downsides" — in `documentation.md`.

---

## Data storage (multi-pod deployment!)

Rule: in-memory only for what does not require cross-pod consistency **and** is
ephemeral. Full table — in `documentation.md`. In short:

| Data | Where |
|---|---|
| tenants, oauth_clients, audit_log | **Postgres** (TypeORM) |
| idempotency, webhook dedup | **Postgres** (KvStore→PG, TTL, atomic `INSERT … ON CONFLICT … WHERE expired`) |
| rate-limit | self-standing per-pod `@nestjs/throttler` v5 (correctness independent of the ingress; an ingress limit, if any, is optional defense-in-depth, not authoritative) |
| credentials cache | **in-memory per-pod** (cache from Vault, not the source of truth) |
| partner secrets | SecretStore (Vault) |

**Redis is NOT used** (removed by request). The client has Redis in their stack — if
an exact global rate-limit is ever needed, it can be reused.

---

## Endpoints

- **OAuth2:** `POST /oauth/token` (client_credentials → JWT 15 min; form-urlencoded and JSON).
- **Cross-Border** (auth: external Bearer JWT / internal `X-Internal-Token`+`X-Tenant-Id`):
  `GET balances`, `GET rates`, `POST quotes`, `POST quotes/confirmations`,
  `POST payments` (+ `Idempotency-Key`), `GET payments/:id`, `GET payments?ref=`,
  `POST payments/:id/cancel`.
- **Admin** (`X-Admin-Token`): `GET/POST /admin/tenants`, `…/approve/platform`,
  `…/approve/mastercard`, `…/suspend|unsuspend`, `…/clients` (issue), `GET /admin/audit`.
- **Webhook:** `POST /webhooks/mastercard` (in-service fail-closed `X-Webhook-Token`, required in prod and dev; mTLS at the ingress optional, additional — not the authentication).
- **Swagger:** `GET /api-docs` (off in production unless `SWAGGER_ENABLED`).

---

## ⚠️ CRITICAL: encryption-key breakdown (there was a lot of confusion)

In `certs/` — two Mastercard key concepts:

| File | What it is | Role |
|---|---|---|
| `Fintory-sandbox-signing.p12` | our signing private key | OAuth1 signing (password `MC_SIGNING_KEY_PASSWORD`, opens) |
| `...fintory1-mastercard-encryption-key.p12` | **Mastercard Encryption Key** (`CN=MasterCardKey`) | **encrypt REQUESTS**; opens with an EMPTY password + `-nomacver` |
| `...clientenc...-client-encryption-key.pem` | **Client Encryption Key** (ours, public cert) | to decrypt RESPONSES; no private key |
| `mastercard-encryption-cert.pem` | extracted from the `fintory1` p12 | what we encrypt with (`MC_ENCRYPTION_CERT_PATH`) |

**The correct `kid` for requests = the public-key fingerprint of the Mastercard key:**
`cec428ec9f5cdf80532cf3db313875439b755e0e9751ed0af512b59741478cf1` (matched
`fintory1` on the portal; it's the **public key** fingerprint, not the certificate
`53b8…`). In `.env` (`MC_ENCRYPTION_FINGERPRINT`).

**Sandbox does NOT support FLE:** plain quote → 200 with a real proposal, encrypted
→ `Crypto Key/082000`. Encryption can only be tested in **MTF/Production** (via the
CIS team). Hence `MC_ENCRYPTION_ENABLED="false"` for sandbox.

**Decrypting responses in prod requires the private Client Encryption Key** — we only
have the public `.pem`. From the original ZIP at key creation, or by regenerating on
the portal → into `MC_DECRYPTION_KEY_PATH`. Not needed in sandbox.

---

## Running (Windows + project on a WSL UNC path)

`node`/`npm` are on Windows. A direct `npm run` from Git Bash fails on UNC paths.
Workaround — via `pushd` from **PowerShell**:

```powershell
cmd /c "pushd \\wsl.localhost\Ubuntu\home\isaak\valeri\mastercard && <command> & popd"
```

**Postgres required.** In WSL:
```bash
cd ~/valeri/mastercard
docker compose up -d        # Postgres 16 (docker-compose.yml)
npx ts-node src/main.ts     # auto-schema (synchronize) + test tenant seeds
```
Seeds (non-prod only): `platform`, `acme` (ACTIVE), `own-sandbox` (OWN/ACTIVE, keys
from LocalSecretStore), `own-demo` (PENDING — demo gating).

Dev scripts: `npm run ping`, `npm run encrypt-poc` (+`plain`), `src/scripts/p12-diag.ts`.
(`idem-test.ts` was removed — idempotency is now in Postgres.)

---

## Env (`.env`, gitignored; `certs/` gitignored)

`MC_SIGNING_KEY_PATH/PASSWORD`, `MC_CONSUMER_KEY`, `MC_PARTNER_ID`
(sandbox=`SANDBOX_1234567`), `MC_BASE_URL`, `MC_ENCRYPTION_CERT_PATH`
(=the extracted MC cert), `MC_ENCRYPTION_FINGERPRINT` (=cec4…),
`MC_ENCRYPTION_ENABLED` (false), `MC_DECRYPTION_KEY_PATH` (empty, for prod),
`MC_SECRET_STORE` (local),
`MC_JWT_SECRET`/`MC_INTERNAL_TOKEN`/`MC_ADMIN_TOKEN`/`MC_WEBHOOK_TOKEN` (dev; in prod
the gate in main.ts requires strong ones), `TRUST_PROXY` (empty),
**`DATABASE_URL`** (postgres://mc:mc@localhost:5432/mc_gateway),
**`DB_SYNC`** (true in dev; in production `synchronize` is ALWAYS off),
**`DB_POOL_MAX`** (per-pod pool, default 10). `REDIS_URL` — removed. A values-free
template — `.env.example` (in the repo).

---

## Versions (aligned with the client's b24club-api)

Nest 10, `@nestjs/jwt` 10.1.1, `@nestjs/throttler` ^5, `@nestjs/swagger` 7.3.0,
`@nestjs/config` 3.1.1, `reflect-metadata` 0.1.x, `axios` 1.6.0, `typeorm` 0.3.20,
`@nestjs/typeorm` ^10.0.2, `class-transformer` 0.5.1. Our extra packages (not in the
client's): helmet, mastercard-client-encryption, mastercard-oauth1-signer, node-forge.
No conflicts (typecheck + peer-check OK; one benign class-validator/mapped-types
warning — the client has the same combo).

---

## Enhancements after the core (hardening, audit, tests)

- **Encryption → axios interceptor** in `MastercardClient` (request: encrypt→sign;
  response: decrypt). `CrossBorderService` is clean.
- **Rate-limit behind a proxy:** `/oauth/token` — limit by **client_id**
  (`OAuthThrottlerGuard`, not bypassable by IP rotation); `TenantThrottlerGuard` —
  strictly by `tenantId`, **fail-closed** (no context → error, not a shared bucket);
  `TRUST_PROXY` — number of ingress hops (not `'true'`).
- **Error messages** (exceptions + `throw new Error`) translated to **English**
  (client-facing + crash logs). Comments and `Logger.*` are in Russian.
- **10-cycle audit** (bugs/security/optimization, all typecheck + live regressions):
  (1) `synchronize` **off in production** (NODE_ENV gate; otherwise auto-alter = data
  loss); (2) `bootstrap().catch`→exit(1); (3) `safePartnerId` anti-traversal
  (`..`/`\`); (4) **batching** of audit inserts (buffer + flush/sec + on shutdown +
  before `recent()`); (5) guarded `JSON.parse` in idempotency (corrupt cache→409 not
  500); (6) a successful payment is not lost on a result-cache failure; (7) retry
  **GET only** on 502/503/504+network (POST never; config rebuilt each attempt);
  (8) `DB_POOL_MAX` (default 10) — per-pod pool (otherwise pods×10 > Postgres
  max_connections); (9) webhook **at-least-once** (release the dedup key on failure);
  (10) fire-and-forget cleanup of expired KV.
- **e2e on a live Postgres run** (Docker inside WSL): admin/tenants, both auth paths,
  gating 403/404, real balances/rates/quote, idempotency, rate-limit→429, webhook
  dedup, **persistence after pod restart**. Report — `tests.md`. Not covered: JWE
  (sandbox without FLE), successful payment+cache (needs the KYC flow).
- **Native Nest modules** (used off-the-shelf, all verified live): health probes
  `@nestjs/terminus` (`/health`, `/ready`); ENV validation `ConfigModule.validate`
  (class-validator, fail-fast); TypeORM migrations (`src/database/data-source.ts`,
  `migration:*`, `InitialSchema` generated+run, synchronize off in prod);
  `@nestjs/schedule` `KvCleanupService` (cron cleans kv_store); `nestjs-pino`
  structured JSON logs + correlation-id `x-request-id` + secret redaction. New env:
  `LOG_LEVEL`, `DB_MIGRATIONS_RUN`. To capture pino stdout cleanly run the server with
  `node -r ts-node/register src/main.ts` (the cmd-detach redirect does not capture pino's stdout).

---

## OPEN QUESTIONS / tasks (important)

1. **TypeORM: standalone or part of the monolith?** → **ANSWERED:** the client wants
   **a single module** in their `b24club-api` monolith (see "NEXT STEPS" #2). So: drop
   our `forRoot`, entities via `forFeature` in THEIR DataSource, their migrations (not
   `synchronize`). ← this is what we do.
2. ~~Removing `Idempotency-Key`~~ — **DECIDED TO KEEP** (client confirmed 2026-06-10).
   `IdempotencyService` stays on `POST /crossborder/payments`.
3. 🔴 **per-tenant encryption BLOCKER:** the interceptor encrypts with the **platform**
   key, while OWN partners have different MC encryption keys → in MTF/Prod the request
   would be encrypted with the wrong key and MC would reject it. `CredentialsService`
   already resolves per-tenant `encryptionCertPem/...`, but nobody uses them. Fix —
   thread the keys into `EncryptionService`. See `production-questions.md`.
4. **Prod keys:** private Client Encryption key (decryption), `MC_ENCRYPTION_ENABLED=true`
   in MTF/Prod, prod secrets instead of dev defaults, OWN partners' partner-id/keys in Vault.
5. Optional: RFI subsystem, observability, cleanup of expired `kv_store` (cron;
   `@nestjs/schedule` adds a dependency).

---

## TEAM-LEAD FEEDBACK — DONE (2026-06-11, commits e319802 + fe9cd86)

1. ✅ **One Mastercard module.** Umbrella `src/mastercard.module.ts`
   (`MastercardModule`, via `ConfigurableModuleBuilder` → `forRoot/forRootAsync`) — the
   only module the host imports. Sub-modules became private. Config arrives as options
   (`MastercardModuleOptions`) and is distributed via a global `GatewayConfig`
   (`src/config/gateway-config.ts`) — services no longer read `process.env`/`ConfigService`.
   Internal client renamed to `MastercardClientModule`. DB = host DataSource (`forFeature`);
   `AppModule`+`main.ts` kept as a dev harness. Per-pod throttler moved INTO the module.
2. ✅ **DTOs on every endpoint.** Strict on our boundaries (`TokenRequestDto`,
   `CreateTenantDto` with `@ValidateIf` for OWN→secretRef, `McWebhookEventDto`); soft on
   MC passthrough (`QuoteRequestDto`/`PaymentRequestDto`/`ConfirmationRequestDto`,
   validate only critical field formats). The global `ValidationPipe` was REMOVED (an
   embeddable module must not impose one + it double-validated and stripped MC fields).
   Each controller carries its own pipe: `strictDtoPipe` (admin/oauth) vs
   `mcPassthroughPipe` (crossborder/webhook, `transform:false` so string amounts survive).
   Manual validation (`admin.service`, `typeof body`) removed.
3. ✅ **Webhook security in-service, not infra.** `WebhookAuthGuard` fail-closed: token
   required everywhere, no `return true` "relying on mTLS". + `WebhookSignatureVerifier`
   scaffold (Noop until MC spec, C1). `main.ts` prod gate requires `MC_WEBHOOK_TOKEN`.
   Throttler "authoritative = ingress" comment removed (per-pod limit is self-sufficient).
4. ✅ **Thin modules collapsed.** EncryptionModule→provider of MastercardClientModule;
   IdempotencyModule→provider of CrossBorderModule; HealthModule→controller in the umbrella.
   Genuine feature modules kept (Tenant/Auth/Admin/CrossBorder/Webhooks/Credentials/
   Secrets/Store/Audit).
5. ✅ **Entities co-located** (commit `09c4ece`). Removed the central `database/entities/`
   folder; each entity lives in its module: `TenantEntity`→`tenants/`,
   `OAuthClientEntity`→`auth/`, `AuditLogEntity`→`audit/`, `KvEntity`→`store/`. `database/`
   keeps only infra (DatabaseModule, data-source, migrations). Schema and table names
   unchanged; typecheck + e2e 10/10.
6. ✅ **Audit shutdown race fixed** (commit `bb9a6ea`): buffer flush moved to
   `beforeApplicationShutdown` (an earlier phase than TypeORM closing the connection) —
   no more "Connection terminated" on shutdown.

**Verified:** typecheck OK; `src/scripts/boot-check.ts` (DI graph) OK;
`src/scripts/e2e-check.ts` — **8/8 on live sandbox** (quote 201 w/ proposal and string
amounts; amount=number→400 from the DTO; OWN-without-secretRef→400; bad grant_type→400;
webhook without token→401, with token→200).

### Remaining (NOT part of the 5 team-lead points)
- **Remaining MC APIs** (compared with `api-mastercard.md`): Cancel Confirmed Quote
  (`POST crossborder/quotes/cancellations`), Retrieve Confirmed Quote
  (`GET crossborder/quotes/{ref}/proposals/{id}`), Account Validation
  (`POST crossborder/accounts/validations`), Bank Lookup (`crossborder/banks/details`),
  Account generation (`crossborder/accounts/generate`). Separate opt-in suites → ask E1 first.
- **Webhook signature** — implement `WebhookSignatureVerifier` per MC spec (C1).
- **Embedding into `b24club-api`:** host must include our entities in its DataSource and
  run their migrations; provide `ScheduleModule.forRoot()` for the kv cleanup cron.
- The **per-tenant encryption** blocker before prod-OWN is still open.

---

## Where we stopped (last action of the session)

All **5 team-lead points** implemented (see above) — 2 commits (`e319802`, `fe9cd86`),
pushed to `github.com/migirov/mastercard`. Verified live (boot-check + e2e 8/8 on
sandbox). Docs (`memory.md`, `architecture.md`, `api.md`, README) updated for the new
structure (umbrella `MastercardModule` + `GatewayConfig` + per-controller pipes).
Secret-gate clean before every commit.

> Important about the environment: the "Bash" tool is Git Bash/MINGW on Windows (sees
> the project over UNC, does NOT see `/home`); run Docker and git via `wsl -d Ubuntu ...`.
> Node — Windows, via `pushd`. Postgres container `mc-gateway-postgres`.
