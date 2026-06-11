# Tests — gateway internals

Tests for our own layer that **do not reach Mastercard** (rejected earlier — at
guards/gating/validation — or are infrastructure). Mastercard integration tests
(outbound calls + webhooks) are in [tests.md](./tests.md).

Related: [api.md](./api.md), [architecture.md](./architecture.md),
[documentation.md](./documentation.md).

> Environment and startup — see [tests.md](./tests.md#environment). `$base = http://localhost:3000`.
> Seeds: `platform`, `acme` (PLATFORM/ACTIVE), `own-sandbox` (OWN/ACTIVE), `own-demo` (OWN/PENDING).

---

## 1. Authentication and access

Validate our layer; **rejected before reaching Mastercard** (at guards/gating).

| # | Test | Expected | Result |
|---|---|---|---|
| GW-1 | `GET /admin/tenants` (admin token) | list from Postgres | ✅ 200, 4 tenants, computed statuses, no `secretRef` |
| GW-2 | `GET /crossborder/balances` without auth | 401 | ✅ 401 `missing bearer token` |
| GW-3 | `GET /admin/tenants` wrong admin token | 401 | ✅ 401 `invalid admin token` |
| GW-4 | `POST /admin/tenants/own-sandbox/clients` | issue client_id/secret | ✅ 201, 32-char secret, `note` (shown once) |
| GW-5 | `POST /oauth/token` (client_credentials) | JWT | ✅ Bearer, expires_in=900 |
| GW-6 | `POST /oauth/token` wrong secret | 401 | ✅ 401 `invalid_client` (timing-safe) |
| GW-7 | gating: own-demo (PENDING) | 403 | ✅ 403 `…is not active (status PENDING)` |
| GW-8 | unknown tenant | 404 | ✅ 404 `Tenant 'nope' not found` |

```bash
# issue OAuth client → token (external auth path)
curl.exe -s -X POST -H "X-Admin-Token: ..." $base/admin/tenants/own-sandbox/clients   # 201 + secret (once)
curl.exe -s -X POST $base/oauth/token -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=<cid>&client_secret=<sec>"               # JWT 900s
# gating / not found (never reaches MC)
curl.exe -s -H "X-Internal-Token: ..." -H "X-Tenant-Id: own-demo" $base/crossborder/balances   # 403
curl.exe -s -H "X-Internal-Token: ..." -H "X-Tenant-Id: nope"     $base/crossborder/balances   # 404
```

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
> itself uses the same Postgres `setIfAbsent` as webhook dedup (see
> [tests.md](./tests.md) WH-2); a successful cache requires a valid payment.

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
- **Run 4 (final):** all categories on the code with 5 native modules
  (terminus/env-validation/migrations/schedule/pino) + 5 audit fixes — **25/25 green**.

## Not covered (internal)

- **Metrics/tracing** (Prometheus/OTel) — logs are ready (pino), metrics are not.
