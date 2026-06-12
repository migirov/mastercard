# Mastercard Cross-Border Gateway — architecture (as-built)

Reflects the **actually implemented** state of the service. Related documents:
[documentation.md](./documentation.md) (entities, storage, encryption, scenarios),
[plan.md](./plan.md) (status by phase),
[production-questions.md](./production-questions.md) (pre-prod blockers),
[memory.md](./memory.md) (session context).

> **UPDATE 2026-06-11 (refactor per team-lead feedback).** The module topology
> changed: the whole integration is now ONE embeddable umbrella `MastercardModule`
> (`src/mastercard.module.ts`, via `ConfigurableModuleBuilder`, `forRoot/forRootAsync`)
> that the host app (the `b24club-api` monolith or the dev-harness `AppModule`)
> imports in one line. Config arrives as options and is distributed via a global
> `GatewayConfig` (`src/config/gateway-config.ts`) — services do NOT read
> `process.env`/`ConfigService`. There is no global `ValidationPipe` anymore: each
> controller carries its own pipe (`strictDtoPipe` for admin/oauth, `mcPassthroughPipe`
> without `transform` for bodies going to MC). Webhook auth is fail-closed in-service
> (+ a signature-verifier scaffold), not "trust the ingress". Thin modules
> (Encryption/Idempotency/Health) were collapsed into providers/a controller. Details
> in [memory.md](./memory.md), section "TEAM-LEAD FEEDBACK — DONE". The sections below
> about "standalone" and the module list describe the previous layout.

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
   │ audit/kv_store   │
   └──────────────────┘
```

## 4. State storage (multi-pod deployment)

Rule: keep in-memory **only** what is ephemeral and does not require consistency
across pods; everything domain-related is in **PostgreSQL**. Full breakdown in
[documentation.md](./documentation.md#data-storage-where-db-where-in-memory).

| Data | Where |
|---|---|
| `tenants`, `oauth_clients`, `audit_log` | **PostgreSQL** (TypeORM) |
| payment idempotency, webhook dedup | **PostgreSQL** (`kv_store`, TTL, atomic `setIfAbsent`) |
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

Toggle `MC_ENCRYPTION_ENABLED` (sandbox=plain, MTF/Prod=JWE). `EncryptionService` is
isolated — it can be extracted into a separate microservice if needed (downsides —
in documentation.md).

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

| Module | Responsibility |
|---|---|
| `DatabaseModule` | PostgreSQL connection (TypeORM `forRoot`) |
| `StoreModule` | `KvStore` → `PostgresKvStore` (idempotency, webhook dedup) |
| `TenantModule` | `TenantRegistry` over Postgres, statuses, seeds |
| `CredentialsModule` | `CredentialsService` (PLATFORM/OWN), cache |
| `SecretsModule` | `SecretStore`: Local (dev) / Vault (prod) |
| `AuthModule` | OAuth2, `TenantAuthGuard`, `AdminAuthGuard`, `OAuthThrottlerGuard` |
| `AdminModule` | onboarding partners, approvals, issue/revoke OAuth clients, `GET /admin/audit` |
| `MastercardModule` | `MastercardClient` (axios + encrypt/sign/decrypt interceptors) |
| `EncryptionModule` | `EncryptionService` (JWE, env toggle) |
| `IdempotencyModule` | `IdempotencyService` (via `KvStore`) |
| `AuditModule` | `AuditInterceptor` (global) + `AuditService` → Postgres |
| `WebhooksModule` | receive MC push notifications (in-service fail-closed `X-Webhook-Token`; mTLS at the ingress optional, additional), dedup |
| `CrossBorderModule` | business endpoints: quote / payment / retrieve / cancel / confirm |
| `HealthModule` | `@nestjs/terminus` — `/health` (liveness), `/ready` (readiness + DB ping) |
| `common/` | p12/crypto utils, `TenantThrottlerGuard` |

Native Nest platform capabilities (used off-the-shelf, no hand-rolling):
- **Rate-limit** — `@nestjs/throttler` (`ThrottlerModule.forRoot`), in-memory per-pod.
- **Health probes** — `@nestjs/terminus` (`HealthModule`) for k8s.
- **ENV validation** — `ConfigModule.forRoot({ validate })` (class-validator), fail-fast at startup.
- **Cron** — `@nestjs/schedule` (`KvCleanupService` cleans expired `kv_store`).
- **Logs** — `nestjs-pino`: structured JSON + correlation-id (`x-request-id`), secret redaction.
- **Migrations** — TypeORM CLI (`data-source.ts`, `migration:*`); `synchronize` off in prod.

## 11. Security (payment-grade)

- **Tenant isolation:** credentials are resolved strictly from the authenticated
  context; partner A cannot use partner B's keys.
- **Idempotency-Key** on payments (double-charge protection; backstop — MC
  `transaction_reference`); the key is validated (length/charset).
- **Audit trail** on all operations — without bodies or secrets.
- **OAuth2:** HS256 pinning, constant-time secret hash comparison, `no-store`.
- **Prod gates** in `main.ts`: refuse to start with weak/default secrets and without
  `MC_SECRET_STORE=vault`; helmet; 256kb body limit; `trust proxy` via env.
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
  TypeORM migrations, cron cleanup of `kv_store`, structured logs (pino) + correlation-id.
- ⬜ **Before prod:** per-tenant encryption, private Client key, Vault implementation,
  metrics/tracing (Prometheus/OTel), RFI — see [production-questions.md](./production-questions.md).
