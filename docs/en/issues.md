# Team-lead issues — status & decisions

Per-issue log of feedback raised by the team lead: the **requirement**, **what was done**,
**what was deliberately NOT done**, and **why** (with documentation references). Kept so the
reasoning behind each decision is auditable (especially where we diverge from a literal reading).
RU version — [docs/ru/issues.md](../ru/issues.md).

---

## Issue 1 — Align TypeORM config

**Requirement (verbatim).**
> Remove `synchronize` and switch to migrations-only schema management. We should follow the
> NestJS/TypeORM recommendations and manage schema changes through migrations only.
> `entities: [...MASTERCARD_ENTITIES],` — remove.
> Reference: https://docs.nestjs.com/recipes/sql-typeorm

**Decision basis.** The linked page (`recipes/sql-typeorm`) is the "build a `DataSource` from
scratch with custom providers" recipe, which **its own warning** says "contains a lot of overhead
that you can omit using the ready-to-use `@nestjs/typeorm` package" and defers to
[`techniques/sql`](https://docs.nestjs.com/techniques/database). This project already uses
`@nestjs/typeorm`, so we follow `techniques/sql` — whose **"Auto-load entities"** section
prescribes exactly `autoLoadEntities: true`, and whose warnings prescribe migrations-only. That
is precisely the intent of the issue.

### Done ✅
- **`src/database/database.module.ts`** (dev-harness runtime; not shipped into the host):
  - `entities: [...MASTERCARD_ENTITIES]` → **`autoLoadEntities: true`** — entities are picked up
    from each sub-module's `TypeOrmModule.forFeature(...)` (techniques/sql: *"referencing entities
    from the root module breaks application domain boundaries… set `autoLoadEntities: true`"*).
  - **Removed `synchronize` entirely** (TypeORM defaults to `false`) → schema is migrations-only,
    in every environment.
  - `migrationsRun: !isProd || DB_MIGRATIONS_RUN==='true'` — the dev-harness now builds the schema
    from migrations on boot (this replaces the old `synchronize` convenience for local/e2e); in
    production it stays gated (the host / a dedicated Job runs migrations, not every pod).
- **`src/database/data-source.ts`** (TypeORM CLI for `migration:generate/run/revert`):
  - `entities: [...MASTERCARD_ENTITIES]` → **static glob** `*.entity{.ts,.js}` (the doc's
    *"static glob path"* form). Removes the explicit array here too; `synchronize: false` already.
- Comment cleanups referencing `synchronize` (e.g. `src/tenants/tenant.entity.ts`).

### Not done — and why ❌
- **Did NOT rewrite to the recipe's custom `DATA_SOURCE` provider pattern** (`database.providers.ts`
  with `new DataSource().initialize()`, per-entity `*_REPOSITORY` providers, and
  `@Inject('X_REPOSITORY')` in services). Reasons:
  1. The recipe itself recommends the `@nestjs/typeorm` package instead (which we use).
  2. It would **break the embeddable-module design** — the host monolith provides the TypeORM
     `DataSource` (via `forRoot` + `autoLoadEntities`/entity list); a self-owned `DATA_SOURCE`
     provider would conflict with the host's connection.
  3. It would require rewriting repository injection across ~5 modules for no functional gain.
  If the team lead specifically wants this rewrite, it's a separate, larger task — flag it.

### Why `data-source.ts` keeps an entities source (not `autoLoadEntities`)
`autoLoadEntities` is a `@nestjs/typeorm` **`TypeOrmModule`** feature — it does **not** apply to a
raw TypeORM `DataSource`. The CLI's `migration:generate` diffs entity metadata against the DB, so
it needs an entities source. We provide it as the doc-style **static glob** (so there is still no
hand-maintained array). `MASTERCARD_ENTITIES` remains exported from the package for the host
(embedding seam) and for `HostIntegrityService`'s startup check.

### Verification ✅
- `tsc --noEmit` — clean.
- **Fresh DB** (volume recreated): the schema was built **entirely by migrations** on boot
  (`migrationsRun`), no `synchronize`. Confirmed `\dt` → 5 entity tables + `migrations`.
- **unit 184/184**, **hermetic e2e 16/16**, **live e2e 23/23** (real MC sandbox; validations
  return real FLE data; admin/webhook/persist work via `autoLoadEntities`).
- **`migration:generate`** (data-source.ts glob) resolves entities — confirmed.

### Follow-up surfaced by this change → RESOLVED ✅ (migrations now == entities)
Removing `synchronize` exposed a **pre-existing drift**: the old migrations didn't fully match the
entity `@Index()` metadata (index names; the `tx_status` composite column order; and a missing
`tenants.createdAt` index that `synchronize` used to create).

**Resolution (project is not yet deployed anywhere → safe to regenerate):** dropped the dev DB to
empty, removed the two old migrations (`InitialSchema` + `AddTxStatus`) and **regenerated a single
clean `InitialSchema`** from the current entities (`migration:generate` against an empty DB). It
creates all 5 tables with the entity-derived indexes — including the previously-missing
`tenants("createdAt")` index and the correct `tx_status("transactionReference","tenantId")`
composite order. Verified: a follow-up `migration:generate` reports **"No changes in database
schema were found"** → migrations and entities are now in exact sync. `AddTxStatus` is folded into
`InitialSchema`.

**Status:** config change **done + fully verified**; index drift **resolved** (single clean
`InitialSchema`, `migration:generate` clean); e2e re-run on the regenerated schema.

---

## Issue 2 — Move EncryptionService logic to interceptor

**Requirement (verbatim).**
> Move EncryptionService logic to interceptor

**Current state (from the code).** `EncryptionService` is used **only** from the axios
interceptors of `MastercardClient` (`src/mastercard/mastercard-client.service.ts`) — nowhere else
(confirmed by grep: only the interceptor + its spec + the provider registration). Flow: business
logic (`CrossBorderService`) returns a plain object and knows nothing about crypto →
`MastercardClient.request()` → **axios REQUEST interceptor** calls `encryption.encryptRequest()`,
then OAuth1-signs over the encrypted body → **axios RESPONSE interceptor** calls
`encryption.decryptResponse()`. `EncryptionService` holds the JWE implementation, builds the
`JweEncryption` in `onModuleInit`, and enforces the per-tenant fail-loud guard.

**Key finding.** The encryption logic is **already invoked from an axios interceptor, not from
business logic** (a prior refactor moved it out of `CrossBorderService`). So if the goal is
"encryption runs in an interceptor, not in services/business logic", **it is already satisfied
on `main`**.

**Two readings — and our take:**
- **(A) "in an interceptor, not business logic"** → already done. At most cosmetic: extract the
  encryption step out of `MastercardClient.installInterceptors()` into its own named axios
  interceptor so HTTP + OAuth + encryption aren't mixed in one function.
- **(B) literally dissolve `EncryptionService` and inline its logic into the interceptor** →
  possible, but **not recommended**: `MastercardClient` would absorb HTTP + OAuth + JWE (SRP
  violation); we'd lose the `onModuleInit` lifecycle hook (it does file I/O to build the
  `JweEncryption` — not in a constructor, per Nest convention) and the isolated unit tests
  (`encryption.service.spec`). The current split (service holds the logic, interceptor
  orchestrates) is the more idiomatic NestJS design.

**Terminology note.** Here "interceptor" = the **axios interceptor** on the outbound gateway→MC
call. A **NestJS interceptor** (`NestInterceptor`) does NOT fit — it wraps the inbound
merchant→gateway request/response, not the outbound MC call.

**Status:** NEEDS CLARIFICATION before acting — asked on the GitHub issue (does the team lead mean
(A) confirm/cosmetic, or (B) remove the service?). Recommended: **(A)** keep the service; optionally
extract a dedicated encryption axios-interceptor for cleanliness. **Done so far:** nothing changed
in code yet (analysis only).
