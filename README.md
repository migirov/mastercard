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
| [documentation.md](docs/en/documentation.md) | **Entities and concepts** — Tenant, OAuthClient, AuditLog, PaymentIdempotency, TransactionStatus, McCredentials, etc.; where DB / where in-memory; encryption (interceptor); OWN/PLATFORM scenarios; `tenant_id` vs `partner_id`. |
| [api.md](docs/en/api.md) | **Our API reference** — all endpoints (OAuth, Cross-Border, Admin, Webhooks), authentication, request/response examples, rate-limits. |
| [api-mastercard.md](docs/en/api-mastercard.md) | **Official Mastercard docs** for Cross-Border (full reference, ~540 KB). The source of truth for payload formats. |
| [production-questions.md](docs/en/production-questions.md) | **Blockers and questions before production** (incl. per-tenant encryption, secret-manager choice, TypeORM integration). |

---

## ⚠️ The `certs/` folder (required, not in the repo)

Mastercard crypto material is **not committed** (in `.gitignore`: `certs/`, `*.p12`,
`*.pem`, `*.key`). To run, create the `certs/` folder and put your project's keys
from [Mastercard Developers](https://developer.mastercard.com) there.

| File | Purpose | `.env` variable |
|---|---|---|
| `Fintory-sandbox-signing.p12` | private **OAuth1 signing** key | `MC_SIGNING_KEY_PATH` (+ `MC_SIGNING_KEY_PASSWORD`) |
| `client-encryption-cert.pem` | public cert of the **Client Encryption Key** — encrypts REQUESTS (JWE) | `MC_ENCRYPTION_CERT_PATH` (+ `MC_ENCRYPTION_FINGERPRINT`) |
| our private **Mastercard Encryption key** (PEM) | decrypts RESPONSES | `MC_DECRYPTION_KEY_PATH` |

> **Field-level encryption (JWE) works in every environment, including sandbox**
> (verified 2026-06-16). Set `MC_ENCRYPTION_ENABLED=true` once the cert + key are
> configured, or leave it `false` to run plain (a signing key + consumer key is enough).
> **Key direction — do not invert (inverting yields MC error `082000`):** encrypt
> REQUESTS with the **Client Encryption** public cert (`MC_ENCRYPTION_CERT_PATH`); decrypt
> RESPONSES with our **Mastercard Encryption** private key (`MC_DECRYPTION_KEY_PATH`).
> Key details — in [architecture.md](docs/en/architecture.md) and [documentation.md](docs/en/documentation.md).

### `.env` (also not in the repo)

Configuration and secrets — in `.env` (in `.gitignore`). Key variables:

```
MC_BASE_URL, MC_CONSUMER_KEY, MC_PARTNER_ID
MC_SIGNING_KEY_PATH, MC_SIGNING_KEY_PASSWORD
MC_ENCRYPTION_CERT_PATH, MC_ENCRYPTION_FINGERPRINT, MC_ENCRYPTION_ENABLED
MC_DECRYPTION_KEY_PATH                  # for MTF/Prod
DATABASE_URL, DB_POOL_MAX               # PostgreSQL
MC_JWT_SECRET, MC_INTERNAL_TOKEN, MC_ADMIN_TOKEN, MC_WEBHOOK_TOKEN
MC_SECRET_STORE                         # local (dev) | aws-secrets-manager (prod)
MC_SECRET_STORE_REGION                  # optional AWS region for the secret store (else AWS_REGION / IAM role)
TRUST_PROXY                             # number of ingress hops behind a proxy (only for a correct req.ip; used by the rate-limit IP fallback — not related to auth)
```

In production, gates apply (`src/harness/main.ts`): refuse to start with weak/default secrets
and require `MC_SECRET_STORE=aws-secrets-manager`. The schema is migrations-only (no `synchronize`).

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
npx ts-node src/harness/main.ts # http://localhost:3000, schema from migrations + platform seed
```

Smoke test: `npm run ping` (balances through a test tenant). Swagger: `/api-docs`.

> **Windows + project on WSL:** node runs from Windows, while a direct `npm run`
> fails on UNC paths. Workaround:
> `cmd /c "pushd \\wsl.localhost\Ubuntu\...\mastercard && npm run ping & popd"`.

---

## DB migrations (production)

The schema is managed by **migrations** (TypeORM CLI) in every environment —
`synchronize` is never used. In **dev** the harness builds it from migrations at
startup (`migrationsRun`); in **production** migrations are applied on deploy.
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
  secrets/        SecretStore: Local (dev) | AWS Secrets Manager (prod)
  auth/           OAuth2, guards, admin authentication, DTOs
  admin/          onboarding partners, approvals, issuing OAuth clients, DTOs
  mastercard/     low-level client module (axios encrypt/sign/decrypt + EncryptionService)
  crossborder/    business endpoints by area (accounts/quotes/payments/validations/
                  cash-pickup/rfi) over a shared gateway; payment idempotency (Postgres)
  audit/          operation log (Postgres, batched writes)
  webhooks/       push notifications + fail-closed auth (token) + DTO
  database/       TypeORM (dev harness; a host provides its own DataSource)
  health/         health/readiness probes (@nestjs/terminus) — controller in the dev
                  harness (AppModule), not the embedded module
  common/         p12/crypto utils, throttler guards, validation pipes
  harness/        dev harness — app.module.ts + main.ts + dev-seed.service.ts
                  (standalone run, e2e, Swagger); not part of the embeddable surface
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

**Host integration checklist** — the contract is explicit, not runtime-policed: required
*config* is enforced by `GatewayConfig` (fail-fast — it throws at startup on a missing
required option or a weak production secret), and the host-provided *infrastructure* below
is what the module deliberately does not set up. The module does NOT introspect the host to
warn about these; if an item is omitted, the affected feature fails as noted.

1. **TypeORM DataSource with our entities** — `TypeOrmModule.forRoot({ entities:
   [...MASTERCARD_ENTITIES] })` (or `autoLoadEntities: true`). Missing → repositories
   throw `EntityMetadataNotFoundError` on the first query (loud, not silent).
2. **`app.enableShutdownHooks()`** — required so the audit buffer is flushed on
   `SIGTERM` (`beforeApplicationShutdown`).
3. **Body limit for RFI upload** — `POST /crossborder/rfi/documents` carries a base64
   file up to ~1.37MB, above a typical strict JSON limit. The dev-harness applies this as
   Nest middleware (`AppModule.configure`: a 2MB JSON parser for that route, registered
   before the strict global one). When embedded, the **host owns body parsing**, so it
   must allow ≥~1.4MB for that route — either a route-scoped JSON parser for
   `POST /crossborder/rfi/documents` or a high-enough global JSON limit. Missing → RFI
   uploads near MC's ~1MB limit return `413`.
4. **`webhookToken` set** — required for inbound Mastercard webhooks; empty ⇒
   fail-closed (every `/webhooks/mastercard` request → `401`).
5. **Do not pass `isGlobal: false`** to `forRoot/forRootAsync`. The umbrella module
   is global by default so its exported `GatewayConfig` is injectable by every
   sub-module without each re-importing the umbrella; overriding it to `false` would
   break DI across sub-modules.

> **Convention (module code):** there is no global `ValidationPipe` — every
> controller declares the preset it needs of one shared validation strategy
> (`gatewayValidationPipe(ValidationStrategy.Strict)` for our boundaries,
> `…Passthrough` for bodies forwarded to Mastercard). Any new controller MUST
> declare a pipe explicitly; without one its input is unvalidated (per-route binding
> is fail-open, unlike a global pipe).

---

## Status

The transactional core is complete and verified on a live sandbox; per-tenant
encryption, encrypted-push decryption, and the AWS Secrets Manager store are
implemented. The remaining items are deploy-time — see
[production-questions.md](docs/en/production-questions.md) (strong secrets, mTLS for
MC webhooks, OWN keys loaded into AWS Secrets Manager, `migration:run`, and MTF
confirmation of cross-tenant FLE + encrypted push).
