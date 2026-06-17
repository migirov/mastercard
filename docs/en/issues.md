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

---

## Issue 3 — Use transaction_reference for idempotency

**Requirement (verbatim).**
> Use transaction_reference for idempotency

**Done ✅ (literally as instructed — the idempotency key IS `transaction_reference`).**
- `CrossBorderService.createPayment` now derives the idempotency key from
  `body.paymentrequest.transaction_reference`, hashed as `txref:sha256(ref)` (KV-safe regardless of
  the client's ref length/charset). The body-hash fingerprint is kept (same ref + DIFFERENT body →
  `422`). If `transaction_reference` is absent → no idempotency (MC rejects the payment anyway — the
  field is mandatory there).
- **Removed the old `Idempotency-Key` header path entirely** (the mechanism being replaced): the
  `@IdempotencyKey` param + `@ApiHeader` on the payment route, and the now-orphaned
  `idempotency-key.decorator.ts` / `idempotency-key.pipe.ts` (+ spec). `IdempotencyService` itself is
  unchanged — it still takes a key string; only the *source* of the key changed.
- Tests: `crossborder.service.spec` asserts the key = `txref:sha256(transaction_reference)` and
  `undefined` when the ref is absent; the old e2e "bad Idempotency-Key → 400" test (which exercised
  the removed pipe) was replaced with a payment-reaches-MC check. `api.md` (RU+EN) updated (payment
  section + pipes table + flow).

**Why this is better.** `transaction_reference` is required and is MC's own dedup key, so payment
idempotency is now **automatic and always-on** for every payment — previously it only kicked in if
the client happened to send the optional `Idempotency-Key` header.

**Decision recorded.** We asked whether to keep the header as an optional override; the team lead
chose **(a) remove it entirely** — pure `transaction_reference`.

**Verification:** tsc clean; unit + hermetic + live e2e green.

**Status:** done + verified.

---

## Issue 4 — Remove KvStore-based idempotency

**Requirement (verbatim).**
> Remove KvStore-based idempotency.
> We should avoid a separate KV layer and use Postgres as the source of truth for
> webhook processing.
>
> Remove Idempotency-Key from payment API.
> Payment flow still accepts Idempotency-Key and uses IdempotencyService.
> We should use transaction_reference as the source of truth for payment idempotency instead.

**Context.** Overlaps with Issue 3 but goes FURTHER: Issue 3 only changed the *key source*
(transaction_reference); the mechanism stayed `IdempotencyService` on top of the shared
`kv_store` KV layer. Here we remove the KV layer itself and make Postgres the source of
truth — for both payments and webhooks. (The note "*Payment flow still accepts
Idempotency-Key*" is already stale — the header was removed in Issue 3; only
`IdempotencyService` remained.)

### Decision (confirmed with the user)
Payments fork: "transaction_reference as the source of truth" read two ways — (A) delegate
dedup to MC itself (drop our layer entirely) or (B) keep idempotency in Postgres keyed on
transaction_reference, preserving the guarantees. **Chose (B)** — a `payment_idempotency`
table; the source of truth lives in our DB and double-charge protection stays local (not
"trust MC's dedup"). "Remove KvStore-based idempotency" = drop the KV backend, not
idempotency itself.

### Done ✅
- **Payments → Postgres (`payment_idempotency`).** New `PaymentIdempotencyEntity`
  (`UNIQUE(tenantId, idemKey)` where `idemKey = txref:sha256(transaction_reference)`) and
  `PaymentIdempotencyStore` replacing `IdempotencyService`. Behaviour preserved 1:1:
  - atomic slot claim `INSERT ... ON CONFLICT DO UPDATE` (the UPDATE only re-claims a stale
    in-progress lock via `lockedAt`, so a crashed process can't pin the key forever);
  - MC response cache (`done=true` + `result` jsonb) → a retry returns the result WITHOUT
    re-calling MC;
  - `409` if a request is already in progress; `422` if the same ref arrives with a
    DIFFERENT body (fingerprint);
  - fail-safe: on 5xx/network error the slot is NOT released (MC outcome unknown), on a
    client 4xx it is (retry safe).
  - **Improvement over KV:** completed records are permanent (one transaction_reference =
    one payment forever) instead of a 24h TTL.
- **Webhooks → Postgres (`tx_status`).** `WebhookHandler.handleOther` (non-status events:
  Carded Rate Push, RFI) no longer dedups via `kv.setIfAbsent('wh:<ref>')`; it goes through
  the same atomic `INSERT ON CONFLICT` on `UNIQUE(eventRef)` in `tx_status` — one Postgres
  source of truth for ALL webhooks. The merchant status read (`findForTenant`) is filtered
  to status event types so non-status rows don't surface.
- **KV layer removed entirely:** `src/store/*` (`kv.entity`, `kv.types`, `store.module`,
  `postgres-kv.store`, `kv-cleanup.service`), `src/idempotency/*`. Dropped `KvEntity` from
  `MASTERCARD_ENTITIES` and `StoreModule` from the umbrella module. `KvCleanupService` was
  the only `@Cron`, so the `ScheduleModule` host-check and `ScheduleModule.forRoot()` in the
  dev harness were removed too.
- **Migration:** project not deployed → regenerated a single clean `InitialSchema`
  (`kv_store` dropped, `payment_idempotency` added); a re-run `migration:generate` → "No
  changes".

### Verification ✅
- `tsc --noEmit` clean; **unit 171**, **hermetic e2e 17** (added a payment-idempotency test:
  same ref → cached and MC called once, different body → 422), **live e2e 23** (sandbox).
- Fresh DB: schema built from migrations; `migration:generate` → "No changes".

### Post-review hardening (5 passes: bugs/optimization/security) ✅
- **Correctness (Med):** re-claiming a stale in-progress lock now requires a MATCHING body
  (`fingerprint = EXCLUDED.fingerprint`); otherwise `422`, consistent with the fresh-lock path
  (previously "same ref + different body" bypassed `422` within the stale-lock window).
- **Optimization (Low):** removed the unused `payment_idempotency(lockedAt)` index (it's evaluated
  as a filter on a row already located by the UNIQUE index, not an index scan; there's no background
  cleanup) → regenerated `InitialSchema`.
- **Retention/PII (Low, open infra item):** `payment_idempotency.result` and `tx_status` have no
  app-level TTL (cron removed) → documented in `production-questions.md` (needs a DB retention/prune
  policy, especially for PII).
- Re-checked, no findings: no SQL injection (bound params), tenant isolation via `(tenantId,
  idemKey)`, a non-string `transaction_reference` → `400` (not `500`), the `index.ts` barrel is
  clean, the issue #1 TypeORM config is fine. Tests after fixes: unit 171 / hermetic 17 / live 23.

**Status:** done + fully verified.

---

## Issue 5 — Clean up TenantRegistry bootstrap and demo tenants

**Requirement (verbatim).**
> Clean up TenantRegistry bootstrap and demo tenants
> Implement seed script

**Problem.** `TenantRegistry.onModuleInit` seeded on EVERY boot: `platform` (everywhere, incl.
prod) + demo tenants `acme`/`own-sandbox`/`own-demo` (env-gated on `!isProduction`). Downsides:
the embeddable module silently writes test data into the host DB on boot; demo data and the env
branch are baked into a data-layer service.

### Decision
`onModuleInit` runs INSIDE the embeddable `MastercardModule` too (the `b24club-api` host), so any
boot-time seeding would write into the host DB on every start — exactly what the issue asks to
remove. Therefore:
- **`TenantRegistry` seeds nothing** — a pure data layer; embedding is fully clean (the module never
  touches the host DB on boot).
- **The `platform` baseline is seeded only by the dev harness** (`DevSeedService` in `AppModule`, not
  the embeddable module) — zero-config for local runs / `ping` / e2e.
- **Demo tenants** (acme/own-sandbox/own-demo) come from `npm run seed`.
- **In prod the host** provisions tenants explicitly (admin API or `SEED_DEMO=false npm run seed`).

This makes the bootstrap fully clean, removes the security smell (a pre-approved tenant is created
deliberately, not silently on every boot), and keeps local/e2e zero-config.

### Done ✅
- **`TenantRegistry` is a pure data layer:** dropped `onModuleInit` (and `implements OnModuleInit`),
  demo seeding, the `isProduction` branch, the private `seedIfAbsent`, and the unused
  `GatewayConfig`/`Logger` deps. No seeding/side-effects on boot.
- **New `src/tenants/tenant.seed.ts`** — single source of seed data: `PLATFORM_TENANT`,
  `DEMO_TENANTS` (acme/own-sandbox/own-demo) + idempotent `seedTenants(repo, list)`
  (`INSERT … ON CONFLICT DO NOTHING RETURNING id`, race-free under multi-pod; existing rows are NOT
  overwritten → admin approval/suspend edits survive; returns the ids actually inserted).
- **`src/dev-seed.service.ts` (`DevSeedService`)** — a dev-harness-ONLY provider (in `AppModule`,
  NOT the embeddable `MastercardModule`): on `onApplicationBootstrap` it seeds the baseline
  `platform` (zero-config for `ts-node src/main.ts`/`ping`/e2e). The host doesn't get it → the module
  writes nothing to the host DB on boot.
- **Seed script `scripts/seed.ts`** (`npm run seed`) — boots an `AppModule` context (like `ping`;
  `DevSeedService` seeds `platform` then), seeds the demo tenants; `SEED_DEMO=false` → only the
  baseline `platform`. Idempotent; DB config comes from the same `.env`.
- **e2e:** demo tenants no longer appear "for free" → both suites (`app.contract`/`app.e2e`) seed
  `DEMO_TENANTS` in `beforeAll` (`platform` comes from `DevSeedService` on bootstrap).

### Host implication (record on embedding)
The embeddable `MastercardModule` no longer creates `platform` itself → the host must provision
tenants (`platform` and its own) via the admin API or `SEED_DEMO=false npm run seed`. Recorded in
`production-questions.md` (host integration checklist).

### Verification ✅
- `tsc` clean; on a FRESH DB: **unit 171 / hermetic 17 / live 23**.
- After live e2e on a fresh DB the table holds exactly 4 tenants: `platform` (from `DevSeedService`)
  + `acme`/`own-sandbox`/`own-demo` (from e2e `beforeAll`); `own-demo` pending `f`/`f`.
- `npm run seed` on an empty DB: schema (migrations) + `platform` (DevSeedService) + demo; re-run →
  "already present" (idempotent).

**Status:** done + fully verified.

---

## Issue 6 — Persist encrypted Mastercard webhook events before ack

**Requirement (verbatim).**
> Persist encrypted Mastercard webhook events before ack

**Problem.** Encrypted pushes (`{encrypted_payload:{data}}`) arrive while decryption is NOT yet
wired (the open MTF/Prod blocker: needs the client decryption key + a per-tenant seam). The handler
used to log and immediately `ack 200` WITHOUT storing → after a 200 MC does not retry, so the event
was LOST for good (only a log line remained).

### Done ✅
- **`WebhookHandler.handleEncrypted`:** the raw envelope is PERSISTED to `tx_status`
  (`eventType='ENCRYPTED'`, `payload` = the whole envelope incl. `encrypted_payload.data`) **before**
  the ack. No decryption/processing (fields are under the cipher); the rows are processed later from
  the DB once decryption is wired.
- **persist-before-ack:** if the write fails (DB down) the exception is NOT swallowed → `500` → MC
  retries (no data loss). `200` is returned only after a successful persist.
- **Dedup:** key = a top-level ref if MC sends one OUTSIDE the cipher, else `enc:sha256(ciphertext)`
  (a retry of the identical envelope → dedup via `UNIQUE(eventRef)`; if MC re-encrypts per retry the
  hash differs → a possible duplicate, reconciled after decryption is wired).
- `tenantId=null` (partnerId is under the cipher); such rows are filtered out of the merchant status
  read (`findForTenant` → status types only). No dedicated table — we reuse `tx_status` (the single
  Postgres webhook source of truth, per issue #4).

### Post-review (2 passes: bugs/security/optimization) ✅
- **Bug (Med):** the dedup key was built with `??`, which does NOT drop an empty string — an
  `eventRef` arriving as `''` would become the key and collapse all such events into one row
  (`UNIQUE(eventRef)`) → lost events. Added `firstRef()` (first non-blank after trim); applied in
  `handleEncrypted` AND in `normalize()` (the same latent bug on the status/other paths).
- **Invariant test:** added a test that a persist failure is NOT swallowed (→ exception → 500 → MC
  retries, not a false ack); a test for empty ref → hash; the duplicate log was clarified.
- **Security:** re-checked — token-gated + rate-limited, the ciphertext is opaque and filtered out of
  the merchant read; unbounded growth is covered by the retention item (`production-questions.md`).
- Final checks: **unit 176 / hermetic 18 / live 23**.

### Verification ✅
- `tsc` clean; **unit 174→176** (persist/hash-dedup/outer-ref/empty-ref/persist-failure), **hermetic
  e2e 18** (encrypted push → `200 accepted`, retry of the same → `duplicate`), **live e2e 23**.

**Status:** done + verified. Decryption itself remains the open blocker (needs the client decryption
key + per-tenant seam) — this issue is about durability (not losing the event), not decryption.

---

## Issue 7 — Remove noop Mastercard webhook signature verifier

**Requirement (verbatim).**
> Remove noop Mastercard webhook signature verifier

**Problem.** A `WebhookSignatureVerifier` abstraction (with the default `NoopSignatureVerifier`) was
scaffolded as a "second auth factor" on the webhook path. But reading the MC docs closed the former
"C1" question: MC does NOT sign push bodies — push authenticity at Mastercard is **mTLS** (public
mTLS cert from MC + trust + our cert chain via the KMP portal). So `verify()` could only ever
`return true` — dead code that added a DI provider, an injected dependency, a misleading "valid
signature" test, and unused `rawBody` plumbing, all suggesting a check that does not exist.

### Done ✅
- **Deleted** `src/webhooks/webhook-signature.verifier.ts` (the abstract class + the noop impl).
- **`WebhookAuthGuard`:** dropped the `WebhookSignatureVerifier` injection and the
  `signature.verify(...)` branch (+ the `invalid webhook signature` 401). The guard is now a single
  honest factor — the fail-closed `X-Webhook-Token`. The class doc was rewritten to state plainly
  that MC has no payload signature (authenticity = mTLS); `RawBodyRequest<Request>` → `Request`.
- **`WebhooksModule`:** removed the `{ provide: WebhookSignatureVerifier, useClass: ... }` provider.
- **`main.ts`:** removed `rawBody: true` from `NestFactory.create(...)` — its only purpose was the
  byte-level signature check that no longer exists.
- **Spec:** removed the verifier mock and the "rejects when the signature verifier returns false"
  test; "accepts the correct token (and a valid signature)" → "accepts the correct token".

### Verification ✅
- `tsc` clean; **unit 175 / hermetic 18 / live 23** (the guard spec lost the noop-signature test).
- No remaining references to `WebhookSignatureVerifier`/`rawBody` in `src/` (grep clean).

**Status:** done + verified. If MC ever introduces a real payload signature, it is added then as a
focused change to the guard — there is no value in keeping a noop seam for a check MC does not have.
