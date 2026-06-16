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
audit/                     — AuditInterceptor (per-controller) + AuditService→Postgres
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
- **Webhook:** `POST /webhooks/mastercard` (in-service fail-closed `X-Webhook-Token`, required in prod and dev; MC's authoritative push-notification authenticity = **mTLS**, not a payload signature — see `api.md` → Webhooks).
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
  dedup, **persistence after pod restart**. Report — `tests.md`. Not covered: ~~JWE
  (sandbox without FLE)~~ — **JWE now covered (2026-06-16, FLE works on sandbox)**; still
  uncovered: successful payment+cache (needs the KYC flow), per-tenant key path.
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
   IdempotencyModule→provider of CrossBorderModule; HealthModule→controller (later moved
   to the dev harness `AppModule` — see "Latest milestones").
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

---

## CURRENT STATE (2026-06-14)

Since the 5 team-lead points: deep audits (bugs/opt/security, regressions), a test
foundation (jest), a unified error filter, `any` cleanup. Then a NestJS-conventions
pass verified against the **official docs** (downloaded locally to
`valeri/docs.nestjs.com`): ClassSerializerInterceptor + `@Exclude` on `secretRef`;
removed `process.env` leaks from the embeddable module; `Idempotency-Key` → pipe;
lifecycle — audit timer in `onModuleInit`; single entity list (`mastercard.entities.ts`);
moved `src/scripts` → `scripts/` and e2e → `test/app.e2e-spec.ts` (jest-e2e); **REC-1** —
`AuditInterceptor` moved from a global `APP_INTERCEPTOR` to per-controller (the last
global `APP_*` removed); **REC-2** — `HostIntegrityService` (startup self-check of the
host contract) + host checklist in the README; named throttler. Full doc-grounded audit
(4 agents) — no HIGH/MED deviations.

**Ingress:** zero code dependency on the ingress (webhook fail-closed token in the
service, self-standing per-pod throttler). Docs reframed: auth/rate-limit happen IN the
service; mTLS/ingress is an optional additional layer, not authoritative; `TRUST_PROXY`
is only for `req.ip`.

### Latest milestones (after the doc-grounded audit)
- 🔓 **FLE (encryption) WORKS on sandbox (2026-06-16) — the long-standing "encryption blocker" is gone.**
  Root cause: the MC key model was understood BACKWARDS. Correctly: the **Client Encryption Key**
  (`f031d600`) is the PUBLIC key **WE use to ENCRYPT REQUESTS** (MC holds the private); the **Mastercard
  Encryption Key** is the PUBLIC key **MC uses to ENCRYPT RESPONSES**, and OUR private key decrypts them.
  We were encrypting requests with `cec428ec` (Mastercard Enc) → `082000 Crypto Key`. Fix: generated our
  RSA pair (`certs/client-encryption-private.pem`), created a Mastercard Encryption Key `fintory-decrypt`
  (`75ea7e15`) from a CSR on the portal and **activated** it; `.env`: `MC_ENCRYPTION_ENABLED=true`,
  CERT_PATH=clientenc.pem, FINGERPRINT=`f031d600`, DECRYPTION_KEY_PATH=client-encryption-private.pem.
  Result: **Address/Account/Bank/IBAN Validation + Quote → REAL decrypted data**, live e2e **23/23**,
  hermetic **16/16**. (Details — auto-memory `mastercard-fle-working`.) ⚠️ `.env`/`certs` are gitignored,
  NOT committed; keep the private key. **FIGURED OUT 2026-06-16:** RFI `062000` = the `request_id` is not a
  valid RFC-4122 UUID (version/variant nibbles = 0); with a valid v4 form MC passes the format check but
  the sandbox returns `401` — `partner-id` `SANDBOX_1234567` is not onboarded for RFI (external limit).
  Endpoint Guide `502` = sandbox HTML-500 with no corridor data (external limit). The `EncryptionService`/
  `.env.example` src comments and the doc statuses (RU+EN) are fixed, typecheck clean. **Real remaining
  item: the per-tenant encryption seam.**
- **10-round bug/security/optimization audit + 2 regression rounds** completed —
  **no open HIGH/MED.**
- **4-perspective code-quality review** (architecture / maintainability / API-contract /
  testing) → **Tier 1** refactors applied: centralized MC path map (`mc-paths.ts`);
  composed cross-cutting decorator (`UseGatewayContract`); public-api barrel
  (`src/index.ts`); Swagger gaps filled (`@ApiSecurity('internal')` + `X-Tenant-Id`
  header, `Idempotency-Key` via `@ApiHeader`, `ApiErrorResponses` on all controllers,
  `WebhookAckDto`); +4 new regression test specs. Verdict: senior-level code, no rewrite.
- **Tier 2 refactors** (same review, behavior-preserving, commit `54a8b0a`, pushed):
  **#8 EncryptionService seam** — `encryptRequest(creds, body)` / `decryptResponse(creds,
  body)` (creds threaded from the axios interceptor; implementation STAYS single-key, but
  the contract is now per-tenant → makes the per-tenant encryption blocker structurally
  honest: when MTF access arrives only EncryptionService internals change, not the
  interceptor); **#9 hermetic CI e2e** — split into two suites: `test/app.contract.e2e-spec.ts`
  (CI default, `jest-e2e.json`) overrides MastercardClient + CredentialsService with stubs
  (no live MC / certs, only Postgres + dev env) and deterministically asserts the
  response-mapping branches the live suite can't reach (MC 401/5xx → 502 body hidden,
  4xx-object → envelope + `upstream`, 4xx-HTML → 502, success → shape) plus input
  validation — **10/10**; the live suite `test/app.e2e-spec.ts` is now opt-in
  (`jest-e2e-live.json`, `npm run test:e2e:live`); **#7 CrossBorderService consolidation** —
  a single private `run(tenantId, ctx, build)` (gating → build McRequest from resolved
  creds → dispatch) collapsed the four dispatchers (call/callRef/callCatalog/callGuide) +
  header helpers (mcRefHeaders, catalogHeaders); the ~20 methods drop to a 3–4 line build
  closure (JSDoc kept, header strategy explicit at the call site); createPayment keeps its
  idempotency wrapper. **Tier 3 (prom-client metrics, requestId↔X-Mc-Correlation-Id↔audit
  tracing, options grouping) — NOT done** (needs client coordination).
- **Two more senior code-review passes** (behavior-preserving, pushed): **(1) 8 fixes**
  (`bfedb57`): `HealthController` moved out of the umbrella into the dev harness `AppModule`
  (root `/health`,`/ready` would otherwise collide with the host's probes); `EncryptionService`
  fail-loud guard (refuses to encrypt an OWN tenant with the platform key) + JWE built in
  `onModuleInit`; `AuditService` exponential flush backoff on DB outage; `safeTokenEqual`
  (one primitive for the 3 guards); `parseClientCredentials` (shared OAuth parser, Basic
  precedence — closes a rate-limit bucket bypass); `CreateTenantDto.partnerId` charset; typed
  `UnprocessableEntity (422)` instead of raw `Error` in `CredentialsService`; `agent.destroy()`
  on shutdown. **(2) tests + polish** (`1178bcb`): +4 specs (EncryptionService,
  parseClientCredentials, both auth guards), guard instead of the `as McCredentials` cast,
  non-retryable crypto errors, barrel exports of host-facing types (`ErrorResponseDto`,
  `CredentialMode`/`TenantStatus`), `readonly` value objects, dedup
  `TokenResponse`↔`TokenResponseDto`, shared cash-pickup/endpoint-guide query types. 3rd
  review verdict (incl. tooling/config): senior/staff-level, no regressions; the open tooling
  items (CI/engines/coverage-gate) were decided AGAINST.
- **Tests:** unit jest — **20 suites / 147 tests**; e2e: **hermetic 10/10** (CI default,
  stubbed MC) + **live 23/23** on the live sandbox (`npm run test:e2e:live`).
  ⚠️ verify commands CHANGED: `jest --config ./test/jest-e2e.json` is now the HERMETIC
  suite (needs only Postgres + .env, no live MC); the live sandbox is `npm run test:e2e:live`.

### Mastercard API coverage (client sent the API Reference screenshot — all 15 wanted)
Map: `docs/{en,ru}/api.md` → "Mastercard API Reference — coverage" (screenshot order,
**Sandbox** column + status). **ALL 15 implemented:** 1 Quotes, **2 Quote Confirmation suite ×3**
(confirm + cancel `/quotes/cancellations` + retrieve `/quotes/{ref}/proposals/{id}`),
**3 Carded/FX Rate Pull** (= `GET /crossborder/rates`, MC op `getFxRates` no body; the previous
erroneous POST `/carded-rates` was REMOVED; no MC sandbox), 4 Payment, **5 Address
Validation**, **6 Account Validation suite ×3** (account-validations + bank-lookups +
iban-generations), **7 Cash Pickup ×4 GET**, **8 Endpoint Guide** (GET; sandbox HTML-500 for
generic pid), **9 Status Change Push** (webhook → persisted to `tx_status`; read via
`GET /crossborder/status-events?ref=`), 10 Retrieve Payment, **11 RFI suite ×4**
(retrieve/update/upload/download; sandbox canned-rejects non-onboarded pid; upload uses a
route-scoped 2MB body limit), 12 Cancel, 13 Balance, 14 Payload Encryption; **15 Push
Notifications** — receiver/dedup/**status persistence to `tx_status`** done (STATUS_CHG/
QUOTE_STATUS_CHG: atomic dedup by UNIQUE(eventRef), attribution OWN→partnerId / PLATFORM→shared
pool, camel/snake normalization); webhook authenticity = **mTLS** at deployment.
**Coverage complete.** Only externally-blocked items remain (per-tenant encryption/MTF,
**encrypted-push decryption** (needs the Client key, MTF/Prod), webhook mTLS cert from MC,
prod Client Decryption keys).

**IMPORTANT for new APIs:**
- MC paths are INCONSISTENT — take them from `api-mastercard.md` (don't guess): `/send/v1/`
  (quotes/payment/carded/retrieve/cancel), `/send/` no v1 (confirmations/account-validation/
  RFI), `/crossborder/` no /send, no partner segment (cash-pickup/endpoint-guide), `/send/
  address-validation-service/` (address). partner-id: in the PATH (`this.partner()`=
  encodeURIComponent) for account-validation/RFI; in a HEADER (raw, via `headerSafe()`) for
  cash-pickup.
- **Validation POSTs (#5/#6) require an encrypted payload** → ~~not exercisable on sandbox
  (FLE off)~~. **CORRECTED 2026-06-16:** FLE WORKS on sandbox — once the payload is encrypted
  with the correct Client Encryption key, the validation APIs return real data (Address → 200
  VALID/VERIFIED etc.; e2e asserts the business result). `062000` / `150001 "Encrypted
  Payload"` were caused by the wrong key. **GET catalogs (#7) need no encryption → work live**
  (e2e: cash-pickup countries → 200 with a real country list).
- Pattern: GET catalog — `qs()` + `callCatalog()`; POST validation/lookup — `callRef()` +
  `mcRefHeaders()`. New routes live in `CrossBorderController` (inherit auth/throttle/audit/
  filter), gated by `resolveActive` (ACTIVE tenant). e2e: `node node_modules\jest\bin\jest.js
  --config ./test/jest-e2e.json` (needs Postgres).

### Open blockers (external)
per-tenant encryption (prod-OWN+JWE; the JWE lib needs files, keys = Vault PEM, can't e2e
without MTF); **webhook mTLS authenticity** (the former "C1" — per the MC docs this is mTLS,
NOT a payload signature; needs the public mTLS cert from MC + trust + cert-chain via the KMP
portal; details in `api.md`/`plan.md`/`production-questions.md`); prod Client Encryption keys
(portal).

> `.agentic-security/` (security-plugin scanner output) is in `.gitignore` — do NOT commit.
> Commits: secret-gate → `git commit -F` → push origin main (push as a separate step if
> auto-mode blocks add+commit+push in one command).
