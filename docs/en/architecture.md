# Mastercard Cross-Border Gateway — architecture (as-built)

Reflects the **actually implemented** state of the service. Related documents:
[documentation.md](./documentation.md) (entities, storage, encryption, scenarios),
[plan.md](./plan.md) (status by phase),
[production-questions.md](./production-questions.md) (pre-prod blockers),
[memory.md](./memory.md) (session context).

> **Topology (current).** The whole integration is ONE embeddable umbrella
> `MastercardModule` (`src/mastercard.module.ts`, via `ConfigurableModuleBuilder`,
> `forRoot/forRootAsync`) that the host app (the `b24club-api` monolith or the
> dev-harness `AppModule` via `main.ts`) imports in one line — every sub-module is a
> private implementation detail. The host imports the public symbols (`MastercardModule`,
> `MASTERCARD_ENTITIES`, `GatewayConfig`,
> `MastercardModuleOptions`, plus the host-facing contracts `ErrorResponseDto`,
> `CredentialMode`/`TenantStatus`) **only** from the public-api barrel `src/index.ts`, never
> by deep path. Config arrives as options and is distributed via a global `GatewayConfig`
> (`src/config/gateway-config.ts`) — services do NOT read `process.env`/`ConfigService`.
> There is no global `ValidationPipe`/`APP_FILTER`/`APP_INTERCEPTOR`: cross-cutting
> binding is **per-controller** (a controller declares the preset it needs of one shared
> validation strategy — `gatewayValidationPipe(ValidationStrategy.Strict)` for admin/oauth,
> `…Passthrough` without `transform` for bodies going to MC — plus the
> `@UseGatewayContract()` composed decorator, see §10), so the embeddable module does not
> override the host's error handling. Webhook auth is fail-closed in-service (+ a
> signature-verifier scaffold), not "trust the ingress". `EncryptionService` is collapsed
> into a provider; payment idempotency / webhook dedup live on Postgres (the separate KV
> layer is gone, issue #4); health probes moved to the dev harness (not the umbrella). The single
> entity list lives in `src/mastercard.entities.ts` (`MASTERCARD_ENTITIES`, re-exported by
> the umbrella for the host `DataSource`); entities are co-located in their modules. Host
> integration is an explicit contract (typed options fail-fast in `GatewayConfig` +
> `MASTERCARD_ENTITIES` + the README checklist), not a runtime self-check (issue #10). The
> "standalone" framing in §1 describes the dev-harness run mode.

## 1. Goal

A standalone gateway service to Mastercard Cross-Border Services for a
**multi-merchant** platform. Companies connect to the integration, but **only after
dual approval** — from Mastercard and from the platform. Deployment —
**Docker/Kubernetes, many pods** (horizontal scaling).

## 2. Requirements (from the brief)

- **R1.** The integration is a separate service (not part of the main platform).
- **R2.** Multi-tenant: one service serves many partners.
- **R3.** Access gating: transactions only for approved partners (Mastercard + platform).
- **R4.** Two credential modes:
  - **OWN** *(primary)* — the partner has their own partner-id + their own signing/encryption keys.
  - **PLATFORM** *(secondary)* — shared platform partner-id and keys; the tenant is a logical sub-account.
- **R5.** Two consumption paths:
  - **External REST API** — partner systems send requests directly (OAuth2 client credentials → JWT).
  - **Internal** — our services/UI call from inside (service token + explicit `tenantId`).
- **R6.** Secrets (keys, passwords, consumer keys) — in a **Secret Manager (Vault/KMS)**.

## 3. High-level diagram

```
                External merchants            Internal services / UI
              (OAuth2 Bearer JWT)         (X-Internal-Token + X-Tenant-Id)
                        │                              │
                        ▼                              ▼
                ┌───────────────────────────────────────────────┐
                │            TenantAuthGuard (unified)           │
                │   Bearer JWT → tenantId   |   internal token   │
                │                  sets req.tenantContext        │
                │            then TenantThrottlerGuard           │
                └───────────────────────┬───────────────────────┘
                                        ▼
                ┌───────────────────────────────────────────────┐
                │       CrossBorderService (quote/payment/...)   │
                │              returns a "clean" object          │
                └───────────────────────┬───────────────────────┘
                                        ▼
   ┌──────────────────┐   ┌──────────────────────┐   ┌──────────────────────────┐
   │ TenantRegistry   │   │ CredentialsService   │   │ MastercardClient (axios) │
   │ status/approval  │   │ PLATFORM | OWN       │   │ interceptors:            │
   │ → PostgreSQL     │   │ ← Vault (cache,TTL)  │   │  req: encrypt → sign     │
   └────────┬─────────┘   └──────────┬───────────┘   │  res: decrypt            │
            ▼                        ▼               └────────────┬─────────────┘
   ┌──────────────────┐       ┌────────────┐                     ▼
   │   PostgreSQL     │       │ Vault/KMS  │            api.mastercard.com
   │ tenants/oauth/   │       └────────────┘
   │ audit/tx_status/ │
   │ payment_idempo   │
   └──────────────────┘
```

## 4. State storage (multi-pod deployment)

Rule: keep in-memory **only** what is ephemeral and does not require consistency
across pods; everything domain-related is in **PostgreSQL**. Full breakdown in
[documentation.md](./documentation.md#data-storage-where-db-where-in-memory).

| Data | Where |
|---|---|
| `tenants`, `oauth_clients`, `audit_log` | **PostgreSQL** (TypeORM) |
| payment idempotency | **PostgreSQL** (`payment_idempotency`, `UNIQUE(tenantId, idemKey)`, atomic `INSERT ON CONFLICT`) |
| webhook dedup | **PostgreSQL** (`tx_status`, `UNIQUE(eventRef)`, atomic `INSERT ON CONFLICT`) |
| rate-limit | self-standing per-pod `@nestjs/throttler` (correctness independent of the ingress; an ingress limit, if any, is optional defense-in-depth, not authoritative) |
| credentials cache | **in-memory per-pod** (cache from Vault, TTL) |
| partner secrets | **Vault/KMS** (via `SecretStore`) |

**Redis is not used** — consistent state lives in Postgres; ephemeral rate-limiting
is the self-standing per-pod `@nestjs/throttler` (correctness independent of the ingress).
A cross-pod global limit would need a shared store, which the project intentionally does
not use; an ingress limit, if any, is optional defense-in-depth, not authoritative.

## 5. Tenant model

`Tenant` is stored in PostgreSQL (`tenants`). Full description in
[documentation.md](./documentation.md#tenant). Key points:

| Field | Purpose |
|---|---|
| `id` | internal tenant id (stable, PK) |
| `name` | company name |
| `credentialMode` | `PLATFORM` \| `OWN` |
| `partnerId` | for `OWN` — own; for `PLATFORM` — the shared one is used |
| `secretRef` | Vault path to the secret bundle (for `OWN`) |
| `platformApproved`, `mcApproved`, `suspended` | three independent approval/suspension flags |

**The status is not stored — it is computed** from the flags (`PENDING` →
`PLATFORM_APPROVED` / `MC_APPROVED` → `ACTIVE` → `SUSPENDED`), so it cannot be set
bypassing approvals. **Gating (R3):** transactional endpoints are available only
when `isActive(tenant)` (both approvals and not suspended).

`tenant_id` (our internal) ≠ `partner_id` (external, in the Mastercard URL) — see
[documentation.md](./documentation.md#tenant_id-vs-partner_id-important).

## 6. Credentials: two modes (R4) + resolver

A single type that hides the mode from the rest of the code ([McCredentials](./documentation.md#mccredentials)):

```ts
interface McCredentials {
  consumerKey: string;
  signingKeyPem: string;        // private signing key (PEM)
  partnerId: string;
  encryptionCertPem?: string;   // per-tenant key for JWE request encryption
  encryptionFingerprint?: string;
  decryptionKeyPem?: string;    // for decrypting responses
}
```

- **PLATFORM** → the shared platform set from `.env`/config; cache without TTL.
- **OWN** → `tenant.secretRef` from Vault (`SecretStore`) → the partner's keys; cache
  with TTL (`MC_CREDS_CACHE_TTL_MS`) + stampede dedup + `invalidate()` for rotation.
- **Secrets are not logged and never leave in responses.** Signing is **stateless** —
  `McCredentials` are passed on every call.

> ⚠️ Encryption fields are resolved per-tenant, but `EncryptionService` is currently
> platform-level — per-tenant encryption is not wired (an OWN+Prod blocker, see
> [production-questions.md](./production-questions.md)).

## 7. Encryption and signing — axios interceptors

Field-level encryption (JWE) and OAuth1 signing are moved into the **axios
interceptors** of `MastercardClient` — business logic returns a "clean" object and
knows nothing about crypto. Boundary — **us ↔ Mastercard** (outbound call). Details:
[documentation.md](./documentation.md#encryption--decryption).

```
request interceptor:  1) encrypt body (JWE, x-encrypted:true; passthrough if off)
                      2) sign OAuth1 OVER THE ENCRYPTED body (Authorization)
res interceptor:      decrypt the response body (passthrough if plain) → 502 on failure
```

Toggle `MC_ENCRYPTION_ENABLED` (off=plain passthrough, on=JWE). FLE works in all
environments, sandbox included (proven 2026-06-16): the request is encrypted with the
Client Encryption Key, the response is decrypted with our Mastercard Encryption private
key. `EncryptionService` is isolated — it can be extracted into a separate microservice
if needed (downsides — in documentation.md).

## 8. Request flow (quote example)

1. Inbound → `TenantAuthGuard`: external (Bearer JWT → `tid`) **or** internal
   (`X-Internal-Token` + `X-Tenant-Id`). Sets `req.tenantContext`.
2. `TenantThrottlerGuard`: rate-limit by `tenantId` (fail-closed, no IP fallback).
3. `CrossBorderService`: checks `isActive(tenant)` (otherwise `403`).
4. `CredentialsService.resolve(tenant)` → `McCredentials` (Vault, via cache).
5. Build the path with `partnerId` + clean body → `MastercardClient.request(creds, …)`.
6. Interceptor: encrypt → sign → send; response — decrypt.
7. Unwrapping: 2xx → data; business 4xx → forward to merchant; 401/403/5xx/network → `502`.
8. The global `AuditInterceptor` writes a record (who, method, path, status, ms) — without bodies.

## 9. Authorization (R5)

- **External:** the partner gets OAuth2 client credentials (`POST /oauth/token` →
  JWT 15 min). `client_id`/`secret` are stored hashed; rate-limit on `/oauth/token`
  is by **`client_id`** (`OAuthThrottlerGuard`, not bypassable by IP rotation behind a proxy).
- **Internal:** trusted services — `X-Internal-Token` + explicit `X-Tenant-Id`.
- Both paths converge on a single `req.tenantContext` (`@CurrentTenant`), so the code
  doesn't know where the request came from. `tenantId` is **never** taken from the
  body/query — only from authentication.

## 10. NestJS modules

The host imports **only** `MastercardModule` (the umbrella). Everything below is a
private sub-module wired up inside it. The umbrella registers the per-pod
`ThrottlerModule` directly, provides `GatewayConfig` (from the `forRootAsync` options),
and re-exports `MASTERCARD_ENTITIES`. Health probes
(`/health`, `/ready`) live in the dev harness (`AppModule`), NOT in the umbrella —
root-level probes would collide with the host monolith's own (when embedded the host
owns liveness/readiness).

| Module / unit | Responsibility |
|---|---|
| `MastercardModule` (umbrella) | the only module the host imports (`forRoot/forRootAsync`); aggregates all sub-modules, provides global `GatewayConfig`, registers `ThrottlerModule` |
| `TenantModule` | `TenantRegistry` over Postgres, statuses (PURE data-layer — seeds nothing on boot); `TenantEntity` co-located. Seeding lives outside: `platform` via the dev harness `DevSeedService` (`AppModule`), demo via `npm run seed` (`tenant.seed.ts`); the host provisions its own |
| `CredentialsModule` | `CredentialsService` facade → `PlatformCredentialsProvider` / `OwnCredentialsProvider`; OWN cache via cache-manager v5 (in-memory, LRU 500 + TTL; issue #15 — no stampede coalescing in v5); boundary guards in `utils/credential-sanitize` (issue #14) |
| `SecretsModule` | `SecretStore`: Local (dev) / Vault (prod) |
| `AuthModule` | OAuth2, `TenantAuthGuard`, `AdminAuthGuard`, `OAuthThrottlerGuard`; `OAuthClientEntity` co-located |
| `AdminModule` | onboarding partners, approvals, issue/revoke OAuth clients, `GET /admin/audit` |
| `MastercardClientModule` | the low-level `MastercardClient` (axios + encrypt/sign/decrypt interceptors); `EncryptionService` is a provider here, not its own module |
| `AuditModule` | `AuditInterceptor` (bound per-controller via `@UseGatewayContract()`) + batched `AuditService` → Postgres; `AuditLogEntity` co-located |
| `WebhooksModule` | receive MC push notifications (in-service fail-closed `X-Webhook-Token`; mTLS at the ingress optional, additional); ALL events persist/dedup in `tx_status` via one atomic `INSERT ON CONFLICT` on `eventRef` (no KV layer); status events (STATUS_CHG/QUOTE_STATUS_CHG) carry status/stage and are read by the merchant, tenant attribution (OWN→partnerId / PLATFORM→shared pool), camel/snake normalization |
| `TransactionStatusModule` | `TransactionStatusStore` + `TransactionStatusEntity` (`tx_status`); shared by `WebhooksModule` (writes) and `CrossBorderModule` (tenant-scoped reads for polling) |
| `CrossBorderModule` | business endpoints (all 15 MC API groups) + status polling (`GET /crossborder/status-events`); uses `mc-paths.ts` (centralized MC URL builder); private `PaymentIdempotencyStore` (Postgres `payment_idempotency`) |
| `database/` (dev-harness only) | `DatabaseModule` (TypeORM `forRoot`) used only standalone via `main.ts`; when embedded the host owns the `DataSource` |
| `HealthController` (dev harness) | `@nestjs/terminus` — `/health` (liveness), `/ready` (readiness + DB ping); registered in `AppModule` (harness), NOT the umbrella — root probes would collide with the host; when embedded the host owns probes |
| `PaymentIdempotencyStore` | private `CrossBorderModule` provider; payment idempotency on Postgres (`payment_idempotency`); replaced the old KV-based `IdempotencyService` (issue #4) |
| `common/` | shared cross-cutting utilities (see below) |

**`common/` (shared utilities & patterns):**
- `gateway-contract.decorator.ts` — `@UseGatewayContract()` = composed
  `@UseFilters(GatewayExceptionFilter)` + `@UseInterceptors(AuditInterceptor)`, applied
  **per-controller** (not `APP_*`) so a new controller cannot forget the error
  contract/audit. (`AdminController` keeps its own explicit set with `ClassSerializerInterceptor`.)
- `gateway-validation.pipe.ts` — one shared validation strategy: `gatewayValidationPipe(strategy)`
  with two presets. `Strict` (whitelist + forbid extras + transform) for our boundaries
  (admin/oauth); `Passthrough` (no `transform`/`whitelist`) for bodies forwarded to MC verbatim.
  Shared, stateless pipe instances bound per-route via `@UsePipes`. Replaced the two earlier
  ad-hoc factories `mcPassthroughPipe`/`strictDtoPipe` (issue #12).
- `secret-strength.ts` — `isWeakSecret()` shared by `main.ts` and the `GatewayConfig` prod gate.
- `api-error-responses.decorator.ts` — `ApiErrorResponses()` documenting the unified error shape in Swagger.
- `string-query.pipe.ts` — `StringQueryPipe` rejects non-string query params (objects/arrays).
- The RFI document upload (`POST /crossborder/rfi/documents`) needs a 2MB body limit (base64
  file). The dev harness applies it as Nest middleware (`AppModule.configure`, ordered before the
  256kb global parser); when embedded the host owns body parsing (issue #11).
- `safe-id.pipe.ts`, `oauth-throttler.guard.ts`, `tenant-throttler.guard.ts`, p12/crypto utils,
  `gateway-exception.filter.ts`, `upstream.exception.ts`.

Also at the package root: `src/index.ts` (public-api barrel), `src/mastercard.entities.ts`
(single entity list),
`src/crossborder/mc-paths.ts` (centralized MC URL path builder — MC prefixes are
intentionally inconsistent: `/send/partners` vs `/send/v1/partners` vs bare `/crossborder`
vs the address-validation base; now in one auditable place).

Native Nest platform capabilities (used off-the-shelf, no hand-rolling):
- **Rate-limit** — `@nestjs/throttler` (`ThrottlerModule.forRoot` inside the umbrella;
  one named set `default` 120/min, per-pod), with a per-route override on `/oauth/token`.
- **Health probes** — `@nestjs/terminus` (`HealthController` in the dev harness `AppModule`; when embedded the host owns probes) for k8s.
- **ENV validation** — at the dev-harness boundary (`env.validation.ts`, Zod,
  fail-fast at startup); when embedded the host passes typed `MastercardModuleOptions` and
  `GatewayConfig` enforces the prod gate.
- **Logs** — `nestjs-pino`: structured JSON + correlation-id (`x-request-id`), secret redaction.
- **Migrations** — TypeORM CLI (`data-source.ts`, `migration:*`); `synchronize` off in prod.

## 11. Security (payment-grade)

- **Tenant isolation:** credentials are resolved strictly from the authenticated
  context; partner A cannot use partner B's keys.
- **Payment idempotency** by `transaction_reference` (double-charge protection), source of
  truth in Postgres `payment_idempotency` (no separate KV layer/header; backstop — MC's own
  dedup on the same `transaction_reference`).
- **Audit trail** on all operations — without bodies or secrets.
- **OAuth2:** HS256 pinning, constant-time secret hash comparison, `no-store`.
- **Prod gates:** refuse to start with weak/default secrets (`isWeakSecret()`, shared by
  `main.ts` and `GatewayConfig`) and without `MC_SECRET_STORE=vault`. helmet / body-limit /
  logger / `trust proxy` are dev-harness (`main.ts`) concerns; when embedded the host owns them.
- **Fail-closed** rate-limit guard (no tenant context → error, not a shared bucket).
- Vault: short-lived cache, key rotation without restart (`invalidate`).
- sandbox/MTF/production separation — via environment config, not in code.

## 12. Implementation status (phases)

- ✅ **Phase 1 — Tenant + per-tenant stateless signing.**
- ✅ **Phase 2 — SecretStore (Local/Vault) + OWN mode.**
- ✅ **Phase 3 — Auth (OAuth2 + internal) + approval/gating + admin API.**
- ✅ **Phase 4 — JWE encryption** (in the axios interceptor; env toggle).
- ✅ **Phase 5 — Audit, idempotency, rate-limit.**
- ✅ **Phase 6 — Full operation set** (payment/retrieve/cancel/confirm) + Swagger.
- ✅ **Migration to PostgreSQL** (Redis/in-memory removed as storage).
- ✅ **Platform enhancements:** health probes (terminus), ENV validation,
  TypeORM migrations, structured logs (pino) + correlation-id.
- ✅ **Embeddable umbrella module:** single `MastercardModule` + public-api barrel
  (`src/index.ts`), per-controller cross-cutting binding, `GatewayConfig`; integration is an
  explicit contract (typed options fail-fast + `MASTERCARD_ENTITIES` + README checklist).
- ✅ **Full MC API coverage:** all 15 MC API Reference groups under `/crossborder/*`
  (balances, **rates** (Carded/FX Rate Pull, GET), quotes(+confirmations/cancellations/
  retrieve-confirmed-quote), payments/retrieve/cancel, address-/
  account-validations, bank-lookups, iban-generations, cash-pickup, endpoint-guide,
  RFI requests/documents) + **Push Notifications**: the webhook persists statuses to
  `tx_status`, the merchant reads via `GET /crossborder/status-events`.
- ✅ **Quality:** a 10-round security/bug/optimization audit + 2 regression rounds + a
  4-lens code review (Tier 1 applied); the coverage follow-up (confirm-suite 3/3, carded-rate
  GET, push persistence) went through 3 more analysis rounds (bugs/optimization/security).
  Tests: unit 20 suites / 159, e2e on the live sandbox.
- ⬜ **Before prod:** per-tenant encryption (the JWE interceptor still uses the platform
  key — see §6), webhook signature (C1) and **encrypted-push decryption** (needs the Client key),
  private Client decryption key, Vault implementation, metrics/tracing (Prometheus/OTel) —
  see [production-questions.md](./production-questions.md).
