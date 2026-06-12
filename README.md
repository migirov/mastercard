# Mastercard Cross-Border Gateway

🇬🇧 English · [🇷🇺 Русский](README.ru.md)

A multi-merchant gateway to **Mastercard Cross-Border Services** (NestJS, Node 22,
PostgreSQL). The platform's partners reach Mastercard through us — each with their own
keys and `partner-id`, and only after dual approval (Mastercard + platform).

- Every request is OAuth1-signed with the specific tenant's key (stateless).
- Field-level encryption (JWE) and signing are moved into an axios interceptor.
- Persistence — PostgreSQL (designed for multi-pod deployment on Kubernetes).
- Two access paths: external OAuth2 (merchants) and internal service token.
- k8s-ready: health/readiness probes, structured JSON logs + correlation-id,
  TypeORM migrations, ENV validation at startup.

---

## Documentation (`docs/`)

Available in two languages: **[English — `docs/en/`](docs/en/)** · **[Русский — `docs/ru/`](docs/ru/)**.
The links below point to the English version.

| File | About |
|---|---|
| [architecture.md](docs/en/architecture.md) | **Architecture (as-built)** — diagram, modules, flows, storage, security, phase status. Start here. |
| [documentation.md](docs/en/documentation.md) | **Entities and concepts** — Tenant, OAuthClient, AuditLog, KvEntry, McCredentials, etc.; where DB / where in-memory; encryption (interceptor); OWN/PLATFORM scenarios; `tenant_id` vs `partner_id`. |
| [api.md](docs/en/api.md) | **Our API reference** — all endpoints (OAuth, Cross-Border, Admin, Webhooks), authentication, request/response examples, rate-limits. |
| [api-mastercard.md](docs/en/api-mastercard.md) | **Official Mastercard docs** for Cross-Border (full reference, ~540 KB). The source of truth for payload formats. |
| [plan.md](docs/en/plan.md) | **Plan and status** by phases 1–6 + migrations/enhancements, with the audit history. |
| [tests.md](docs/en/tests.md) | **Mastercard integration tests** — outbound calls to the Cross-Border API + inbound webhooks. |
| [tests-inner.md](docs/en/tests-inner.md) | **Gateway internals tests** — auth/access, reliability, infrastructure (no MC calls). |
| [production-questions.md](docs/en/production-questions.md) | **Blockers and questions before production** (incl. per-tenant encryption, secret-manager choice, TypeORM integration). |
| [client-questions.md](docs/en/client-questions.md) | Open questions for the client about the integration. |
| [memory.md](docs/en/memory.md) | Development handoff context (to restore session state). |

---

## ⚠️ The `certs/` folder (required, not in the repo)

Mastercard crypto material is **not committed** (in `.gitignore`: `certs/`, `*.p12`,
`*.pem`, `*.key`). To run, create the `certs/` folder and put your project's keys
from [Mastercard Developers](https://developer.mastercard.com) there.

| File | Purpose | `.env` variable |
|---|---|---|
| `Fintory-sandbox-signing.p12` | private **OAuth1 signing** key | `MC_SIGNING_KEY_PATH` (+ `MC_SIGNING_KEY_PASSWORD`) |
| `mastercard-encryption-cert.pem` | public cert of the **Mastercard Encryption Key** — encrypts REQUESTS (JWE) in MTF/Prod | `MC_ENCRYPTION_CERT_PATH` (+ `MC_ENCRYPTION_FINGERPRINT`) |
| private **Client Encryption key** (PEM) | decrypts RESPONSES in MTF/Prod | `MC_DECRYPTION_KEY_PATH` *(not needed in sandbox)* |

> **Sandbox does not support field-level encryption** — it runs plain
> (`MC_ENCRYPTION_ENABLED=false`), and a signing key + consumer key is enough.
> Encryption is enabled only in MTF/Production. Key details — in
> [architecture.md](docs/en/architecture.md) and [documentation.md](docs/en/documentation.md).

### `.env` (also not in the repo)

Configuration and secrets — in `.env` (in `.gitignore`). Key variables:

```
MC_BASE_URL, MC_CONSUMER_KEY, MC_PARTNER_ID
MC_SIGNING_KEY_PATH, MC_SIGNING_KEY_PASSWORD
MC_ENCRYPTION_CERT_PATH, MC_ENCRYPTION_FINGERPRINT, MC_ENCRYPTION_ENABLED
MC_DECRYPTION_KEY_PATH                  # for MTF/Prod
DATABASE_URL, DB_SYNC, DB_POOL_MAX      # PostgreSQL
MC_JWT_SECRET, MC_INTERNAL_TOKEN, MC_ADMIN_TOKEN, MC_WEBHOOK_TOKEN
MC_SECRET_STORE                         # local (dev) | vault (prod)
TRUST_PROXY                             # number of ingress hops behind a proxy
```

In production, gates apply (`main.ts`): refuse to start with weak/default secrets,
require `MC_SECRET_STORE=vault`, forbid auto-`synchronize`.

---

## Quick start (dev)

Requires Node 22 and Docker (for PostgreSQL).

```bash
# 1) dependencies
npm install

# 2) PostgreSQL
docker compose up -d            # Postgres 16, see docker-compose.yml

# 3) put the keys in certs/ and fill in .env (see above)

# 4) run the service (dev)
npx ts-node src/main.ts         # http://localhost:3000, auto-schema + tenant seeds
```

Smoke test: `npm run ping` (balances through a test tenant). Swagger: `/api-docs`.

> **Windows + project on WSL:** node runs from Windows, while a direct `npm run`
> fails on UNC paths. Workaround:
> `cmd /c "pushd \\wsl.localhost\Ubuntu\...\mastercard && npm run ping & popd"`.

---

## DB migrations (production)

In **dev** the schema is created by auto-`synchronize`. In **production**
`synchronize` is always off — the schema is managed by **migrations** (TypeORM CLI).
The CLI DataSource: [src/database/data-source.ts](src/database/data-source.ts).

```bash
# generate a migration from entity changes
DATABASE_URL=... npm run migration:generate -- src/database/migrations/Name
# apply (on deploy / a dedicated k8s Job — not on every pod)
DATABASE_URL=... npm run migration:run
# revert the last one
DATABASE_URL=... npm run migration:revert
```

The initial migration (`InitialSchema`) is already in `src/database/migrations/`.
Auto-run at startup — `DB_MIGRATIONS_RUN=true` (in multi-pod prefer an init-container/Job).

---

## Structure

```
src/
  mastercard.module.ts   umbrella module (forRoot/forRootAsync) — the ONLY module a
                         host app imports; wires all sub-modules privately
  config/         GatewayConfig (typed module options) + ENV validation (harness)
  tenants/        partner registry (Postgres), statuses/approvals
  credentials/    key resolver (PLATFORM | OWN), cache
  secrets/        SecretStore: Local (dev) | Vault (prod)
  auth/           OAuth2, guards, admin authentication, DTOs
  admin/          onboarding partners, approvals, issuing OAuth clients, DTOs
  mastercard/     low-level client module (axios encrypt/sign/decrypt + EncryptionService)
  crossborder/    business endpoints + DTOs (quote/payment/retrieve/cancel/confirm)
  idempotency/    payment idempotency (provider on CrossBorderModule)
  audit/          operation log (Postgres, batched writes)
  webhooks/       push notifications + fail-closed auth + signature scaffold + DTO
  store/          KvStore → PostgresKvStore + cron cleanup of expired kv_store
  database/       TypeORM (dev harness; a host provides its own DataSource)
  health/         health/readiness probes (@nestjs/terminus) — controller in umbrella
  common/         p12/crypto utils, throttler guards, validation pipes
  app.module.ts / main.ts   dev harness (standalone run, e2e, Swagger)
docs/             documentation (see the table above)
certs/            Mastercard crypto material (NOT in the repo)
```

### Embedding into a host app (e.g. the b24club-api monolith)

```ts
imports: [
  MastercardModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (c) => ({ baseUrl: c.get('MC_BASE_URL'), /* ...options... */ }),
  }),
]
```

The host provides the TypeORM connection (including our entities) and runs their
migrations, and owns its global pipes/logger/throttler. The module reads config from
the options object, not `process.env`.

**Host integration checklist** — the module deliberately does not set these up; if
the host omits them, the affected feature silently degrades (the module logs a
startup `WARN` for the first two — see `HostIntegrityService`):

1. **TypeORM DataSource with our entities** — `TypeOrmModule.forRoot({ entities:
   [...MASTERCARD_ENTITIES] })` (or `autoLoadEntities: true`). Missing → repositories
   throw on the first query.
2. **`ScheduleModule.forRoot()`** — required for the `@Cron` cleanup of `kv_store`.
   Missing → cleanup never runs (rows are still lazily TTL-deleted on read, so this
   is optional if you accept slower table growth). Not self-imported to avoid a
   double `forRoot()` collision with the host's scheduler.
3. **`app.enableShutdownHooks()`** — required so the audit buffer is flushed on
   `SIGTERM` (`beforeApplicationShutdown`). This one cannot be introspected from a
   provider, so it is documented here only.

> **Convention (module code):** there is no global `ValidationPipe` — every
> controller declares its own pipe (`strictDtoPipe` for our boundaries,
> `mcPassthroughPipe` for bodies forwarded to Mastercard). Any new controller MUST
> declare a pipe explicitly; without one its input is unvalidated (per-route binding
> is fail-open, unlike a global pipe).

---

## Status

The transactional core is complete and verified on a live sandbox (see
[tests.md](docs/en/tests.md)). Before production — see
[production-questions.md](docs/en/production-questions.md) (the main blocker:
per-tenant encryption for OWN partners; the private Client Encryption key;
implementing `VaultSecretStore`).
