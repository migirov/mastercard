# Tests — gateway internals

Tests for our own layer that **do not reach Mastercard** (rejected earlier — at
guards/gating/validation — or are infrastructure). Mastercard integration tests
(outbound calls + webhooks) are in [tests.md](./tests.md).

Related: [api.md](./api.md), [architecture.md](./architecture.md),
[documentation.md](./documentation.md).

> Environment and startup — see [tests.md](./tests.md#environment).
> Seeds: `platform`, `acme` (PLATFORM/ACTIVE), `own-sandbox` (OWN/ACTIVE), `own-demo` (OWN/PENDING).

---

## 0. Unit suite (Jest, `src/**/*.spec.ts`)

**20 suites / 159 tests — all green.** Run: `node node_modules\jest\bin\jest.js`
(see [tests.md](./tests.md#running-the-suite) for the Windows + WSL-UNC note).

| Suite | What it locks in |
|---|---|
| `crypto.util` | `randomToken` (url-safe, unique, length), `sha256hex`, timing-safe `safeEqual` |
| `tenant.types` | `isActive` / `effectiveStatus` (SUSPENDED precedence, partial-approval states) |
| `safe-id.pipe` | identifier whitelist (anti path-injection: empty / `a/b` rejected) |
| `idempotency-key.pipe` | valid key passes; `undefined` allowed; >128 chars rejected (kv_store.key) |
| `gateway-config` | typed getters + defaults; prod rejects weak secrets / non-vault store |
| `idempotency.service` | lock acquire/cache; 4xx releases the lock; 5xx/unknown **keeps** it (anti double-charge); body-fingerprint reuse → 422 |
| `oauth.service` | issues Bearer for a valid client; `invalid_client` and never signs for bad creds |
| `webhook-auth.guard` | fail-closed (no token configured → reject); missing/wrong token → reject; correct token → allow |
| `webhook.handler` | status events (STATUS_CHG/QUOTE_STATUS_CHG) → persist to `tx_status` (record), record=false→duplicate; attribution OWN-partnerId→tenantId else shared pool (null); snake_case normalization; status/stage extracted from `quote.confirmStatus`; non-status → atomic dedup+persist in `tx_status` by `eventRef` (no separate KV layer); encrypted push → persisted before ack (`eventType=ENCRYPTED`), then accept; empty/undefined body → accept (not 500) |
| `tenant-serialization` (admin) | `@Exclude` hides `secretRef`; `TenantViewDto` whitelist; `IssuedClientDto` shows `clientSecret` once |
| `gateway-exception.filter` | unified envelope; nests MC body under `upstream`; RFC 6749 `/oauth/token` shapes; no internals leaked |
| **`crossborder.service`** | MC path construction per operation (incl. Carded/FX Rate Pull = GET `/rates`; confirm/cancel confirmed quote; retrieve confirmed quote with encodeURIComponent on both segments) + `call()` dispatch: 2xx→data, forwardable object 4xx→`UpstreamHttpException`, non-object 4xx→hidden 502, 401/403/5xx & network/decrypt error→502; `encodeURIComponent` on path ids; CRLF-stripped `Partner-Ref-Id`; non-ACTIVE tenant → Forbidden, MC not called; `getStatusEvents` — local `tx_status` read (OWN→includePool=false, PLATFORM→true), MC not called |
| **`mastercard-client.service`** (new) | retry matrix — GET retries transient 502/503/504 up to 3×, POST never retried (anti double-charge); decrypt-no-retry regression: a deterministic decryption failure is NOT retried even on GET |
| **`audit.service`** (new) | flush re-entrancy (no double insert); `capBuffer` drops the **oldest** on overflow + logs the drop; `recent()` second-flush picks up in-flight records; insert failure re-queues the batch |
| **`credentials.*`** (split #14, cache via cache-manager #15) | `own-credentials.provider`: `partnerId` allowlist + `secretRef` anti-traversal (`..`) + bundle validation + 422 contract; cache wiring — second get → one fetch, `invalidate` re-fetches, rejected resolve not cached. `platform-credentials.provider`: build + parse-once cache + onModuleInit warm. `credentials.service`: facade dispatch PLATFORM/OWN + invalidate + unknown-mode throw. (LRU/TTL internals are now cache-manager's, not unit-tested by us.) |

The four **new** suites were added in the recent Tier-1 code-review to lock in the
bug fixes from the audit (see [Run history](#run-history)).

---

## 1. Authentication and access

The E2E suite (`test/app.e2e-spec.ts`) also asserts the pre-MC rejections below; they
fail at guards/gating/validation **before reaching Mastercard**.

Validate our layer; **rejected before reaching Mastercard** (at guards/gating/validation).
These are E2E `it` titles (live app on `:3999`).

| # | Test (`it` title) | Result |
|---|---|---|
| GW-1 | `POST /crossborder/quotes` with `amount=number` → DTO `@IsString` | ✅ 400 |
| GW-2 | `POST /admin/tenants` OWN without `secretRef` → `@ValidateIf` | ✅ 400 |
| GW-3 | `POST /oauth/token` `grant_type=password` → `@IsIn` | ✅ 400 |
| GW-4 | `GET /crossborder/payments?ref=` (empty) → `SafeIdPipe` | ✅ 400 |
| GW-5 | `GET /crossborder/payments?ref=a%2Fb` → anti path-injection | ✅ 400 |
| GW-6 | `GET /admin/tenants/own-sandbox` → no `secretRef`, has `status` | ✅ 200 |
| GW-7 | `POST /crossborder/payments` with a malformed `Idempotency-Key` | ✅ 400 (before MC, message names `Idempotency-Key`) |

> Auth/gating mechanics (admin-token, OAuth client issuance, timing-safe
> `invalid_client`, gating of PENDING tenants, unknown-tenant 404) are pinned by the
> `oauth.service` / `tenant.types` / `tenant-serialization` unit suites in §0.

---

## 2. Reliability

| # | Test | Expected | Result |
|---|---|---|---|
| R-1 | `Idempotency-Key` of 200 chars | 400 locally, before MC | ✅ 400 `up to 128 chars…` |
| R-2 | Payment ×2 with the same `Idempotency-Key` | errors NOT cached → retry | ✅ both 400, **different** MC RequestId; no idem lock left in `kv_store` |
| R-3 | `/oauth/token` ×12 (limit 10/min by client_id) | 10×4xx → 429 | ✅ req 1–10 → 401, 11–12 → **429** |
| R-4 | `GET /admin/audit` | records from Postgres (batched writer) | ✅ 102 records, newest on top (flush before read) |
| R-5 | **Persistence after pod restart** | state survives | ✅ tenants=4 (no duplicate seeds), webhook → duplicate (kv survived), audit not reset |

> R-2 validates that errors do not stick (the lock is released). The 2xx cache
> itself uses the same Postgres `setIfAbsent` as webhook dedup; a successful cache
> requires a valid payment. The lock state-machine (4xx releases, 5xx/unknown keeps),
> the audit batched-writer internals (re-entrancy, overflow drop-oldest, re-queue on
> failure) and the GET-retry / POST-no-retry / decrypt-no-retry matrix are now pinned
> by the `idempotency.service`, `audit.service` and `mastercard-client.service` unit
> suites (§0).

**R-5 (restart):** stop server → start → `GET /admin/tenants` = same 4 (seeds via
`INSERT … ON CONFLICT DO NOTHING`); repeat webhook `evt-test-001` = `duplicate`
(kv_store survived); `audit_log`/`tenants`/`kv_store` not reset. **The goal of the
PostgreSQL migration for multi-pod k8s is met.**

---

## 3. Platform / infrastructure

| # | Test | Result |
|---|---|---|
| I-1 | `GET /health` (liveness, terminus) | ✅ 200 `{"status":"ok"}` |
| I-2 | `GET /ready` (readiness + Postgres ping) | ✅ 200 `{"database":{"status":"up"}}` |
| I-3 | pino: structured JSON log | ✅ all logs JSON |
| I-4 | pino: correlation-id | ✅ incoming `X-Request-Id` picked up as `req.id` and echoed in the response |
| I-5 | pino: redact + slim logs | ✅ `X-Admin-Token`/`Authorization` not in logs; only `id/method/url + status` |
| I-6 | reqId sanitization: malicious `X-Request-Id` (200 chars) | ✅ replaced with a UUID (anti log-injection) |
| I-7 | ENV validation on startup | ✅ boot with no false positives |
| I-8 | platform-creds preload (`onModuleInit`) | ✅ loaded at startup (boot without errors) |
| I-9 | TypeORM migration `InitialSchema` | ✅ generated + run (created 4 tables) |
| I-10 | cron cleanup of `kv_store` (SQL) | ✅ expired row removed (`DELETE WHERE expiresAt<now()`) |

```bash
curl.exe -s $base/health   # {"status":"ok",...}
curl.exe -s $base/ready    # {"status":"ok","info":{"database":{"status":"up"}},...}
# correlation-id + slim log (example line):
# {"level":30,...,"req":{"id":"trace-test-123","method":"POST","url":"/oauth/token"},
#  "res":{"statusCode":429},"responseTime":1,"msg":"request completed"}
```

---

## Run history

- **Runs 1–2:** functional + reliability.
- **Run 3:** 10-cycle audit (bugs/security/optimization) + 4 regression cycles — no regressions.
- **Run 4:** all categories on the code with 5 native modules
  (terminus/env-validation/migrations/schedule/pino) + 5 audit fixes.
- **Run 5 (current):** after a 10-round security/bug/optimization audit + 2 regression
  rounds + a 4-lens code-quality review, the fixes were locked into the automated
  suite. Four new unit suites (`crossborder.service`, `mastercard-client.service`,
  `audit.service`, `credentials.service`) were added. Current status:
  **unit 20 suites / 159 tests green** (after the coverage follow-up: confirm-suite 3/3,
  carded-rate GET, push persistence to `tx_status` — +3 analysis rounds bugs/opt/security),
  **E2E** against the live sandbox. Coverage spans all 15 MC API groups.

## Not covered (internal)

- **Metrics/tracing** (Prometheus/OTel) — logs are ready (pino), metrics are not.
