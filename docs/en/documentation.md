# Documentation: entities

Description of the domain entities of the Mastercard Cross-Border Gateway.

Related documents: [architecture.md](./architecture.md) (design),
[plan.md](./plan.md) (status), [memory.md](./memory.md) (session context).

## Sections

- [Data storage](#data-storage-where-db-where-in-memory) — where Postgres, where in-memory
- [Encryption](#encryption--decryption) — JWE interceptor, extraction into a separate service
- [Operating scenarios](#operating-scenarios-merchant-model) — merchant model (OWN / PLATFORM)

## Entity list

| Entity | Storage | Purpose |
|---|---|---|
| [Tenant](#tenant) | Postgres `tenants` | Partner/merchant on the platform |
| [OAuthClient](#oauthclient) | Postgres `oauth_clients` | Partner's OAuth2 client (API access) |
| [AuditLog](#auditlog-auditentry) | Postgres `audit_log` | Operation log record |
| [KvEntry](#kventry-kv_store) | Postgres `kv_store` | Idempotency + NON-status webhook dedup (with TTL) |
| [TransactionStatus](#transactionstatus-tx_status) | Postgres `tx_status` | Persisted status push notifications (Status Change) |
| [McCredentials](#mccredentials) | not stored (resolve + cache) | Resolved Mastercard keys for a tenant |
| [MerchantSecretBundle](#merchantsecretbundle--keymaterial) | SecretStore/Vault | Partner secrets (keys, consumerKey) |
| [McWebhookEvent](#mcwebhookevent) | status → `tx_status`; others not stored | Mastercard push-notification payload |

---

# Data storage (where DB, where in-memory)

The service is deployed to Docker/Kubernetes on **many pods**. Hence the rule:

> Keep in-memory **only** what does not require consistency across pods **and** is
> ephemeral (losing it on a pod restart is not critical). Everything domain-related
> and consistency-requiring goes to **PostgreSQL**.

| Data | Where | Layer | Why |
|---|---|---|---|
| `tenants` | **Postgres** (TypeORM) | domain | created on pod A → needed on pod B |
| `oauth_clients` | **Postgres** (TypeORM) | domain | key issued on A → authentication on B |
| `audit_log` | **Postgres** (TypeORM) | domain | aggregated across all pods |
| `idempotency` | **Postgres** (`KvStore`→PG, TTL) | domain | payment retry on another pod → otherwise a double charge |
| webhook dedup (NON-status) | **Postgres** (`KvStore`→PG, TTL) | domain | MC webhook retry on another pod → otherwise a duplicate |
| `tx_status` (status push) | **Postgres** (TypeORM) | domain | status arrives on pod A → merchant reads on B; dedup = UNIQUE(eventRef) |
| rate-limit | self-standing per-pod `@nestjs/throttler` | ephemeral | correctness independent of the ingress; an ingress limit, if any, is optional defense-in-depth, not authoritative |
| credentials cache | **in-memory per-pod** | cache | source of truth — Vault/env; pods cache independently from one source, TTL bounds staleness |
| partner secrets | SecretStore (Vault) | external | managed by the secret manager, not our layer |

**Redis is NOT used** — Postgres is chosen for consistent state; for ephemeral
rate-limit — the self-standing per-pod `@nestjs/throttler` (correctness independent
of the ingress); an ingress limit, if any, is optional defense-in-depth, not authoritative.

**Storage stack:** PostgreSQL + TypeORM (`@nestjs/typeorm`), `synchronize` in dev
(auto-schema), migrations in prod. Connection via `DATABASE_URL`.

---

# Encryption / decryption

Mastercard requires **field-level encryption (JWE)**: the request body to MC is
encrypted, the response is decrypted. Code: [`src/encryption/`](../../src/encryption/),
integration — in [`src/mastercard/services/mastercard-client.service.ts`](../../src/mastercard/services/mastercard-client.service.ts).

## Where it lives (separate service + interceptor)

- **`EncryptionService`** — a separate service (JWE via `mastercard-client-
  encryption`), toggle `MC_ENCRYPTION_ENABLED` (off=plain, on=JWE; FLE works in all
  environments, sandbox included — proven 2026-06-16).
- Called **transparently from the axios interceptor** of `MastercardClient`, **not**
  from business logic. `CrossBorderService` returns a clean object and knows nothing
  about crypto.

> Important: "interceptor" here is the **axios interceptor** at the **us ↔ Mastercard**
> boundary (outbound call), NOT a NestJS controller interceptor (the merchant ↔ us
> boundary). What we encrypt is what we send to MC.

## Flow (strict order)

```
request interceptor:  1) encrypt the body (encrypted_payload + x-encrypted:true)
                      2) sign OAuth1 OVER THE ENCRYPTED body (Authorization)
                      3) send
response interceptor: decrypt the response body (passthrough if plain)
```

The signature must be computed over the already-encrypted body — that's why both
encryption and signing live in the same request interceptor. A decryption failure → 502.

## Can it be extracted into a separate service/process

**Yes** — `EncryptionService` is already isolated, and its call in the interceptor
can be replaced with a client to a separate encryption microservice (gRPC/HTTP). The
extraction point is local.

**Why we have NOT extracted it yet (downsides of a separate process):**
- 🔑 **Keys would move** into that service — the attack surface grows and distributing/
  rotating private keys becomes harder.
- 🐢 **A network round-trip** on every encrypt/decrypt → payment latency increases.
- 🧩 Error/timeout handling and transactionality become harder.
- ⚙️ In a single Node process the interceptor **does not offload CPU** — encryption is
  computed in the same place. A separate process offloads CPU, but at the cost of the above.

**Current decision:** the interceptor in the same service — it decouples the **code**
(business logic clean, crypto isolated in `EncryptionService`), without network
overhead and without moving keys out. If horizontal crypto offloading is needed later
— replace the `EncryptionService` call in the interceptor with a client to a separate service.

---

# Operating scenarios (merchant model)

The platform is multi-merchant, and partners connect via one of **two concepts** (the
client confirmed: both are needed). The tenant concept is set by the `credentialMode`
field ([CredentialMode](#credentialmode--where-mastercard-keys-come-from)).

Key fact (verified against the Mastercard docs): **there is no `merchant`/sub-account
field in the Cross-Border API**. Mastercard distinguishes entities **only by
`partner-id` in the URL path**. Hence the two scenarios.

## Primary scenario — `OWN` (a partner-id per partner)

**Essence:** the partner is already registered with Mastercard as a standalone
partner — they have **their own `partner-id` and their own keys** (signing,
encryption). They connect to our platform as a gateway and serve **their own**
business clients through us.

**How it works:**
- Mastercard sees **each partner separately** — natively by their `partner-id`.
- We store the partner's keys **per-tenant** in SecretStore/Vault (by `secretRef`).
- A request is signed and encrypted with the **partner's keys** and goes out under
  **their `partner-id`**.
- `credentialMode = OWN`, the tenant has `partnerId` and `secretRef` filled in.

**When:** this is the **target** scenario per the client's brief. It fits when the
connected companies are themselves Mastercard partners with their own onboarding.

```
partner X ──(own keys, partner-id X)──► Mastercard sees partner X
partner Y ──(own keys, partner-id Y)──► Mastercard sees partner Y
```

## Secondary scenario — `PLATFORM` (the platform's shared partner-id)

**Essence:** the **platform** itself is a partner in Mastercard (one `partner-id`, one
set of keys). Merchants operate as **logical sub-accounts** under the shared
`partner-id`.

**How it works:**
- Mastercard sees **one** entity — the platform. **Merchant separation exists only on
  our side** (our `tenant_id` + our accounting/audit), because there is no merchant
  field in the API.
- All requests are signed with the **platform's shared keys** and go out under the
  **shared `partner-id`**.
- `credentialMode = PLATFORM`, the tenant's `partnerId`/`secretRef` are not needed
  (the shared one is taken from the platform config).

**When:** when the connected merchants do not have (or do not want) their own
Mastercard onboarding and operate "under the platform's wing".

```
tenant A ┐
tenant B ├─(shared platform keys, shared partner-id)─► Mastercard sees the platform
tenant C ┘   (the A/B/C distinction is only in our system)
```

## Comparison

| | `OWN` (primary) | `PLATFORM` (secondary) |
|---|---|---|
| partner-id | own per partner | shared platform one |
| Mastercard keys | own per partner (Vault) | shared platform ones |
| How MC distinguishes partners | natively by partner-id | not at all — it sees the platform |
| Where merchant isolation is | at MC + with us | **only with us** |
| Tenant fields | `partnerId` + `secretRef` | — |
| MC onboarding | own per partner | one (the platform's) |

## Important: a partner's "business clients" are not MC entities

In both scenarios the end clients (payment sender/recipient) are **transaction data**
(`sender_account_uri` / `recipient_account_uri`, e.g. a phone number), not separate
entities in Mastercard and not our tenants. A tenant = **a partner**, not its end client.

---

# Tenant

**Tenant** — a partner/merchant on our multi-merchant platform. It is the central
entity: access (OAuth clients), Mastercard credentials, approval status, and isolation
(rate-limit, idempotency, audit) are all tied to it.

> `tenant_id` — our internal stable client identifier; not to be confused with
> `partner_id` (the Mastercard identifier, a tenant field). Details at the end.

Code: [`src/tenants/tenant.types.ts`](../../src/tenants/tenant.types.ts),
registry: [`src/tenants/services/tenant.registry.ts`](../../src/tenants/services/tenant.registry.ts).

## Fields

| Field | Type | Req. | Description |
|---|---|:---:|---|
| `id` | `string` | yes | Internal tenant identifier (primary key). Stable. |
| `name` | `string` | yes | Human-readable company name. |
| `credentialMode` | `CredentialMode` | yes | Where Mastercard keys come from: `PLATFORM` or `OWN`. |
| `partnerId` | `string?` | no | OWN only: the partner's own partner-id in Mastercard. For `PLATFORM` the shared platform partner-id is used. |
| `secretRef` | `string?` | no | OWN only: path to the partner's secrets in SecretStore/Vault. |
| `platformApproved` | `boolean` | yes | Approval from the platform (our operator). |
| `mcApproved` | `boolean` | yes | Approval from Mastercard. |
| `suspended` | `boolean` | yes | Emergency suspension (overrides approvals). |

The status (`ACTIVE` etc.) is **not stored** — it is computed from the flags (see
below), so it cannot be set bypassing approvals.

## Enums

### CredentialMode — where Mastercard keys come from

| Value | Meaning |
|---|---|
| `PLATFORM` | Shared platform keys and partner-id; the tenant is a logical sub-account. Secondary scenario. |
| `OWN` | The partner's own keys and partner-id (secrets in Vault by `secretRef`). **Primary scenario.** |

### TenantStatus — computed access status

| Status | When |
|---|---|
| `PENDING` | No approvals at all. |
| `PLATFORM_APPROVED` | Approved by the platform, but not Mastercard. |
| `MC_APPROVED` | Approved by Mastercard, but not the platform. |
| `ACTIVE` | Approved by both and not suspended → **transactions allowed**. |
| `SUSPENDED` | Suspended (`suspended = true`), regardless of approvals. |

## Computed logic

```ts
isActive(t)        = !t.suspended && t.platformApproved && t.mcApproved
effectiveStatus(t) = t.suspended            ? SUSPENDED
                   : platform && mastercard  ? ACTIVE
                   : platform                ? PLATFORM_APPROVED
                   : mastercard              ? MC_APPROVED
                   :                           PENDING
```

**Gating:** transactional operations (quote/payment/…) are allowed only when
`isActive(tenant) === true` (checked in `CrossBorderService`).

## Lifecycle

```
       created (admin)
          │  platformApproved=false, mcApproved=false, suspended=false
          ▼
       PENDING ──approve/platform──► PLATFORM_APPROVED ─┐
          │                                             │ approve/mastercard
          └──approve/mastercard──► MC_APPROVED ─────────┤
                                                        ▼
                                                     ACTIVE  ◄── both approvals
                                                        │
                                          suspend ◄─────┴─────► unsuspend
                                                        ▼
                                                    SUSPENDED
```

Approvals are independent and come from different places: `platformApproved` is set
by our operator, `mcApproved` — upon actual Mastercard approval (manually via the
admin API or, eventually, via a webhook).

## Relationships with other entities

- **OAuthClient** — a tenant has 0..N OAuth2 clients (`client_id`/`secret`) through
  which the partner's external systems call the API. Issued via the admin API.
- **McCredentials** — resolved from the tenant (`CredentialsService.resolve`): for
  `PLATFORM` from the platform config, for `OWN` — from SecretStore by `secretRef`.
- **partner-id** — a tenant field (`OWN`) or the shared platform partner id
  (`PLATFORM`); used only at the boundary with Mastercard (in the URL path).
- Isolation by `tenant_id`: rate-limit, payment idempotency, audit trail.

## Example (JSON, admin API view)

```json
{
  "id": "acme",
  "name": "ACME Corp",
  "credentialMode": "OWN",
  "partnerId": "BEL_MCSXB1HS5fd",
  "platformApproved": true,
  "mcApproved": true,
  "suspended": false,
  "status": "ACTIVE"
}
```

> In admin API responses the `secretRef` field is **not returned** (an internal path
> to secrets), and `status` is added as computed.

## Where it lives and how it is managed

- **Storage:** PostgreSQL (`TenantRegistry` over a TypeORM repository, table
  `tenants`) — the source of truth, shared by all pods.
- **Creation/management — admin API** (under `X-Admin-Token`):
  - `POST /admin/tenants` — create (starts in `PENDING`);
  - `POST /admin/tenants/:id/approve/platform` — platform approval;
  - `POST /admin/tenants/:id/approve/mastercard` — Mastercard approval;
  - `POST /admin/tenants/:id/suspend` · `…/unsuspend` — suspend/unsuspend;
  - `POST /admin/tenants/:id/clients` — issue an OAuth client to the tenant;
  - `GET /admin/tenants` · `GET /admin/tenants/:id` — view.

### Validation on creation (`CreateTenantDto`)

| Field | Rule |
|---|---|
| `name` | string, up to 120 chars, required |
| `credentialMode` | `PLATFORM` or `OWN`, required |
| `id` | string, up to 64 chars, optional (otherwise generated) |
| `partnerId` | string, up to 128, optional |
| `secretRef` | string, up to 256, optional; required for `OWN` (checked in the service) |

## tenant_id vs partner_id (important)

- `tenant_id` — **our** stable internal id (auth, accounting, isolation).
- `partner_id` — **the Mastercard identifier** (external, in the request URL).
- Relationship: `OWN` — 1:1; `PLATFORM` — many tenants → one shared partner-id.
- They must be separated because partner_id is external and can differ by environment
  (sandbox `SANDBOX_1234567` ≠ prod), while a tenant exists in our system already at
  the `PENDING` stage, when partner_id may not yet be confirmed.

---

# OAuthClient

**OAuthClient** — a `client_id`/`client_secret` pair via which the partner's external
systems obtain an access token (`POST /oauth/token`, grant `client_credentials`) and
then call the Cross-Border API with a Bearer JWT. One tenant has 0..N clients.

Code: [`src/auth/services/client-registry.ts`](../../src/auth/services/client-registry.ts),
entity (co-located in the module): [`src/auth/entities/oauth-client.entity.ts`](../../src/auth/entities/oauth-client.entity.ts).
Table `oauth_clients`.

## Fields

| Field | Type | Description |
|---|---|---|
| `clientId` | `varchar(64)` PK | Public client identifier (`mc_…`). |
| `tenantId` | `varchar(64)` (indexed) | Which tenant it belongs to. |
| `secretHash` | `varchar(128)` | **SHA-256 of the secret** — the raw secret is NOT stored. |
| `revoked` | `boolean` | Whether revoked (soft delete; invalid for authentication). |
| `createdAt` | `timestamptz` | When issued. |

## Behavior

- **Issuance** (`POST /admin/tenants/:id/clients`): a `clientId` and `clientSecret`
  (crypto-random) are generated, only the hash is written to the DB. **The raw secret
  is returned ONCE** in the admin API response — afterwards it cannot be recovered.
- **Validation** (`validate`): a **constant-time** hash comparison (`safeEqual`), and
  the comparison is ALWAYS performed — even if `clientId` is not found (a dummy
  `DUMMY_HASH`), so existing `client_id`s cannot be enumerated by response timing. A
  revoked client → invalid.
- **Revocation** (`DELETE /admin/clients/:clientId`): sets `revoked=true`.

## Relationships

- Belongs to a [Tenant](#tenant) (`tenantId`). On issuance the tenant is checked to exist.
- The access token carries `tid = tenantId`; the guard restores the tenant from it.

---

# AuditLog (AuditEntry)

**AuditLog** — an operation log record: who (tenant), what (method + path), result
(status), how long it took. Written on **every HTTP request** by `AuditInterceptor`,
bound **per-controller** via the composed `@UseGatewayContract()` decorator (not globally
via `APP_INTERCEPTOR` — the module is embeddable). **Without request/response bodies and without secrets.**

Code: [`src/audit/services/audit.service.ts`](../../src/audit/services/audit.service.ts),
interceptor: [`src/audit/interceptors/audit.interceptor.ts`](../../src/audit/interceptors/audit.interceptor.ts),
entity (co-located in the module): [`src/audit/entities/audit-log.entity.ts`](../../src/audit/entities/audit-log.entity.ts).
Table `audit_log`.

## Fields

| Field | Type | Description |
|---|---|---|
| `id` | `serial` PK | Auto-increment (write order). |
| `ts` | `timestamptz` (indexed) | The request timestamp. |
| `tenantId` | `varchar(64)?` (indexed) | Tenant (if the request was authenticated). |
| `source` | `varchar(16)?` | Where the call came from: `internal` / `external`. |
| `method` | `varchar(8)` | HTTP method. |
| `path` | `varchar(512)` | Path **without the query string** (trimmed at `?`). |
| `status` | `int` | HTTP response status. |
| `ms` | `int` | Processing duration, ms. |

## Behavior

- Writing is **fire-and-forget** + **batched** (buffer + flush every second / per 100
  rows / on shutdown): no latency added to the response; an insert error is only
  logged, the request does not fail.
- In parallel a structured log line is written to stdout.
- Reading: `GET /admin/audit` (last 200, by descending `id`; flushes the buffer first).
- **Privacy guarantee:** bodies and headers are not stored — only metadata.

> Note: guard-level rejections (401/403/429) do **not** reach the audit — guards run
> before interceptors. The log covers requests that reached the processing pipeline.

---

# KvEntry (`kv_store`)

**KvEntry** — a universal key-value record with a **TTL**. One table serves two
mechanisms that need cross-pod consistency:
1. **payment idempotency** (key `idem:<tenantId>:<Idempotency-Key>`);
2. **NON-status Mastercard webhook dedup** (key `wh:<eventRef>`). Status push events
   (STATUS_CHG/QUOTE_STATUS_CHG) are deduped NOT here but in
   [`tx_status`](#transactionstatus-tx_status) (UNIQUE(eventRef), dedup+persist atomic).

Code: [`src/store/postgres-kv.store.ts`](../../src/store/postgres-kv.store.ts),
entity (co-located in the module): [`src/store/kv.entity.ts`](../../src/store/kv.entity.ts).
Table `kv_store`.

## Fields

| Field | Type | Description |
|---|---|---|
| `key` | `varchar(256)` PK | Key with the mechanism prefix. |
| `value` | `text` | Value (JSON — e.g. `{done, result}` for idempotency). |
| `expiresAt` | `timestamptz` (indexed) | Expiry moment; expired is treated as absent. |

## Behavior

- **`setIfAbsent`** — an atomic capture via
  `INSERT … ON CONFLICT (key) DO UPDATE … WHERE expiresAt < now()`: inserts, or
  overwrites ONLY an expired record. This underpins the idempotency lock and the
  "first wins" for webhooks (no races between pods).
- **`get`** — reads and, if the record is expired, deletes it (fire-and-forget) and
  returns `null`.
- **TTL:** idempotency — a short `in-progress` lock (120s, > MC timeout), then the
  result for a day; webhook dedup — a day.
- **Cleanup:** expired rows are removed by a cron job (`KvCleanupService`, hourly,
  `@nestjs/schedule`, under a `pg_try_advisory_xact_lock` so only one pod cleans per
  cycle; the `DELETE` is **batched via `LIMIT`/`ctid`** so one pass removes at most
  `CLEANUP_BATCH` rows and never holds a long lock), plus lazily on read.

---

# TransactionStatus (`tx_status`)

**TransactionStatus** — persists MC status push notifications (Status Change / Quote
Status Change) for merchant delivery via polling. Dedup AND write are **atomic**: a single
`INSERT … ON CONFLICT (eventRef) DO NOTHING` (no "crash between marking dedup and writing
the status" window that a separate kv-dedup would have).

Code: [`src/webhooks/services/transaction-status.store.ts`](../../src/webhooks/services/transaction-status.store.ts),
entity: [`src/webhooks/entities/transaction-status.entity.ts`](../../src/webhooks/entities/transaction-status.entity.ts).
Table `tx_status`.

## Fields

| Field | Type | Description |
|---|---|---|
| `id` | `serial` PK | Auto-increment. |
| `eventRef` | `varchar(200)` UNIQUE, null | Dedup key (NULLs don't conflict → ref-less events always insert). |
| `tenantId` | `varchar(64)` null | OWN → resolved by `partnerId`; PLATFORM/unknown → `NULL` (shared pool). |
| `transactionReference` | `varchar(256)` null | Transaction/quote reference. |
| `eventType` | `text` null | `STATUS_CHG` / `QUOTE_STATUS_CHG`. |
| `transactionType` | `text` null | `QUOTE` / `PAYMENT`. |
| `status` | `text` null | Status (from `quote.confirmStatus.status` or top level). |
| `stage` | `text` null | Stage (`pendingStage`: Expired/Ambiguous, etc.). |
| `payload` | `jsonb` | The raw (normalized) event in full. |
| `receivedAt` | `timestamptz` (indexed) DEFAULT now() | Receipt moment. |

Indexes: UNIQUE(`eventRef`); composite (`transactionReference`, `tenantId`) — for the
read-by-ref path; (`receivedAt`).

## Behavior

- **Write (`record`)** — an atomic `INSERT … ON CONFLICT DO NOTHING RETURNING id`:
  `true` = inserted (fresh), `false` = duplicate. **No truncation** (issue #8): the projection
  columns (eventType/transactionType/status/stage) are `text` — no width to overflow, so an
  overlong value from the uncapped MC body can't cause "value too long" → 500 (which would break
  the always-200 contract + trigger an endless MC retry). The indexed `varchar` columns
  (`eventRef`/`transactionReference`) are bounded upstream by the webhook DTO's `@MaxLength`,
  `tenantId` is an internally resolved id.
- **Read (`findForTenant`)** — by `transaction_reference`, tenant-scoped: OWN sees STRICTLY
  its own rows; PLATFORM sees its own + the shared pool (`tenantId IS NULL`). `LIMIT 200`,
  ordered by `id ASC`. Endpoint: `GET /crossborder/status-events?ref=`.

---

# McCredentials

**McCredentials** — resolved Mastercard keys for a specific tenant. **Not stored in
the DB** — computed from the tenant in `CredentialsService.resolve` and cached
in-memory (per-pod). The rest of the code works only with this type and **does not
know** whether these are the shared platform keys or the partner's own keys.

Code: [`src/credentials/credentials.types.ts`](../../src/credentials/credentials.types.ts),
resolver: [`src/credentials/credentials.service.ts`](../../src/credentials/credentials.service.ts)
(a thin facade — issue #14 — delegating to `PlatformCredentialsProvider` and
`OwnCredentialsProvider`; the OWN cache lives in `OwnCredentialsCache`, the boundary
guards in `utils/credential-sanitize.ts`).

## Fields

| Field | Type | Description |
|---|---|---|
| `consumerKey` | `string` | Consumer key for OAuth1 signing. |
| `signingKeyPem` | `string` | Private signing key (PEM). |
| `partnerId` | `string` | partner-id in the Mastercard URL path (validated for safety). |
| `encryptionCertPem` | `string?` | Cert for JWE request encryption *(per-tenant; see below)*. |
| `encryptionFingerprint` | `string?` | Encryption key fingerprint. |
| `decryptionKeyPem` | `string?` | Private key to decrypt responses. |

## Resolve and cache

- **`PLATFORM`** → from the platform config (`.env`): signing key from `.p12`,
  `consumerKey`, the shared `partnerId`. Cache without TTL (rotation via restart).
  Warmed at startup in `onModuleInit` (fail-fast).
- **`OWN`** → from a [MerchantSecretBundle](#merchantsecretbundle--keymaterial) by the
  tenant's `secretRef`; cached via **cache-manager** (in-memory store, issue #15): **TTL**
  (`MC_CREDS_CACHE_TTL_MS`, default 10 min) + an **LRU cap (500 entries)** so many tenants
  cannot grow it unbounded + `invalidate()` for rotation; a rejected resolve is not cached.
  cache-manager v5 does not coalesce concurrent misses, so the former in-flight stampede
  dedup was dropped (concurrent cold resolves of one tenant may each hit the store). (P12→PEM
  conversions are memoized separately in a synchronous LRU `pemCache`, cap 256.)

> ⚠️ **Known limitation:** the encryption fields (`encryptionCertPem` etc.) are
> resolved per-tenant, but the interceptor encrypts with the **platform** key
> (`EncryptionService` is global-level). The platform FLE itself **works** (proven on
> sandbox 2026-06-16); only the per-tenant seam for OWN partners with their own keys
> is still open — see [production-questions.md](./production-questions.md).

---

# MerchantSecretBundle / KeyMaterial

**MerchantSecretBundle** — the full set of a partner's secrets that `SecretStore`
returns by `secretRef` (`OWN` mode). **Stored in the secret manager** (Vault/KMS), not
in our DB. From the bundle `CredentialsService` assembles [McCredentials](#mccredentials).

Code: [`src/secrets/secret-store.types.ts`](../../src/secrets/secret-store.types.ts).
Implementations: `LocalSecretStore` (dev), `VaultSecretStore` (prod — a stub until a
vendor is chosen).

## MerchantSecretBundle

| Field | Type | Description |
|---|---|---|
| `consumerKey` | `string` | The partner's consumer key. |
| `partnerId` | `string` | The partner's partner-id in Mastercard. |
| `signing` | `KeyMaterial` | Signing key (.p12). |
| `encryptionCertPem` | `string?` | Request encryption cert. |
| `encryptionFingerprint` | `string?` | Encryption key fingerprint. |
| `decryption` | `KeyMaterial?` | Response decryption key. |

## KeyMaterial — .p12 key material

| Field | Type | Description |
|---|---|---|
| `p12Base64` | `string?` | .p12 in base64 (how it comes from Vault). |
| `p12Path` | `string?` | Path to the .p12 (dev). |
| `password` | `string` | The .p12 password. |

Exactly **one** source must be set: `p12Base64` (Vault) or `p12Path` (dev); both are
normalized to PEM (`loadPrivateKeyFromP12*`).

## Boundary validation

`OwnCredentialsProvider.validateBundle` requires the minimum for signing: `consumerKey`
and `signing`. Encryption fields are optional (needed only with `MC_ENCRYPTION_ENABLED`).

---

# McWebhookEvent

**McWebhookEvent** — a Mastercard push-notification payload (`POST /webhooks/mastercard`).
Status events are **persisted** to [`tx_status`](#transactionstatus-tx_status); others
(Carded Rate Push, RFI, etc.) are not stored, only deduped via a `eventRef` marker in
[`kv_store`](#kventry-kv_store).

Code: [`src/webhooks/services/webhook.handler.ts`](../../src/webhooks/services/webhook.handler.ts).

## Fields (known; the payload is extensible)

MC sends fields in TWO notations — camelCase and snake_case; the handler normalizes both.

| Field (camel / snake) | Type | Description |
|---|---|---|
| `eventRef` / `event_ref` | `string?` | Event identifier (dedup key). |
| `notificationId` / `notification_id` | `string?` | Alternative id (dedup fallback). |
| `eventType` / `event_type` | `string?` | Type (`STATUS_CHG`/`QUOTE_STATUS_CHG`/`CARDFX_PUB`/…) — dispatch. |
| `transactionReference` / `transaction_reference` | `string?` | Transaction reference. |
| `partnerId` / `partner_id` | `string?` | Sender partner-id (tenant attribution). |
| `encrypted_payload.data` | `string?` | Marks an encrypted push (decrypt — MTF/Prod). |
| `[key]` | `unknown` | Other payload fields (kept in full in `tx_status.payload`). |

## Behavior

- **Authentication:** in-service fail-closed token (`X-Webhook-Token`), required in prod
  and dev. Mastercard's authoritative authenticity for push notifications is **mTLS**, not a
  payload signature (MC has no JWS/HMAC payload signature; the former "C1" is closed by reading
  the docs). There is no in-code signature check — the single active factor is the token. Details
  and the MC quote — `api.md` → Webhooks.
- **Status events** (`STATUS_CHG`/`QUOTE_STATUS_CHG`) → persisted to `tx_status` via a single
  `INSERT … ON CONFLICT (eventRef) DO NOTHING` (dedup+write atomic). Tenant attribution:
  OWN → by `partnerId`, PLATFORM/unknown → the shared pool (`tenantId=NULL`).
- **Other events** → dedup `setIfAbsent('wh:<eventRef>')` (one-day TTL) + log.
- **Encrypted push** (`encrypted_payload.data`): acked 200 without processing (encrypted
  push only happens in MTF/Prod — sandbox is "Not Applicable"; the decryption key already
  exists, what's left is threading `decryptResponse` into the handler + the per-tenant seam).
- **Always responds 200** (otherwise MC retries). Repeat → `{status:'duplicate'}`,
  otherwise `{status:'accepted'}`.
