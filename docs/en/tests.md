# Tests — Mastercard integration

Tests for everything **related to Mastercard**: outbound calls to the Cross-Border
API (`sandbox.api.mastercard.com`) and inbound webhooks (MC → us). Internal gateway
tests (auth, gating, reliability, infra) are in [tests-inner.md](./tests-inner.md).

Related: [api.md](./api.md), [architecture.md](./architecture.md),
[documentation.md](./documentation.md).

> The Mastercard surface is now verified by the **E2E suite** (`test/app.e2e-spec.ts`,
> Jest, 23/23 green) which runs the real app against the live sandbox over HTTP, plus
> the unit suites that lock in the request-build / response-unwrap logic (see
> [tests-inner.md](./tests-inner.md)). Coverage spans all 15 MC API groups.

---

## Running the suite

```powershell
# Postgres (E2E needs it) — inside WSL
wsl -d Ubuntu -- bash -lc "cd /home/isaak/valeri/mastercard && docker compose up -d"

# Unit suites: 16 suites / 112 tests (rootDir src, *.spec.ts)
node node_modules\jest\bin\jest.js

# E2E against the LIVE sandbox: 23/23
node node_modules\jest\bin\jest.js --config ./test/jest-e2e.json
```

> On this Windows + WSL-UNC setup Jest is invoked via `node node_modules\jest\bin\jest.js`
> — `npx` does not resolve on the mapped drive. The E2E harness boots the real
> `AppModule` on port `3999` (manual bodyParser, `rawBody`, no global pipe — like
> `main.ts`) and drives it with `axios`.

---

## Environment

- **OS:** Windows 10 + project on WSL (Ubuntu), UNC path `\\wsl.localhost\Ubuntu\home\isaak\valeri\mastercard`.
- **Node:** Windows node (no node inside WSL). Docker/git run inside WSL (`wsl -d Ubuntu ...`).
- **PostgreSQL:** Docker inside WSL; reachable from Windows at `localhost:5432`.
- **Mastercard:** sandbox (`https://sandbox.api.mastercard.com`), encryption disabled
  (`MC_ENCRYPTION_ENABLED=false` — sandbox does not support FLE, runs plain).
- **Tenant for MC calls:** `own-sandbox` (OWN/ACTIVE, keys from LocalSecretStore,
  `partner-id` = `SANDBOX_1234567`).

The E2E suite boots the app itself on port `3999`; for manual `curl` exploration you
can also run the dev server on `3000`:

```bash
# Postgres + server
wsl -d Ubuntu -- bash -lc "cd /home/isaak/valeri/mastercard && docker compose up -d"
cmd /c "pushd \\wsl.localhost\Ubuntu\home\isaak\valeri\mastercard && npx ts-node src/main.ts & popd"
```

---

## 1. Outbound calls to the Mastercard Cross-Border API (E2E, live sandbox)

The E2E suite (`test/app.e2e-spec.ts`, **23/23 green**) drives the real app against
`sandbox.api.mastercard.com`. Each MC-bound check exercises the full path: auth →
resolve tenant → OWN credentials from SecretStore → **OAuth1 signature** → HTTPS to
MC → unwrap response. (In MTF/Prod, JWE body encryption is added — plain in sandbox.)
Tenant header: `x-internal-token` + `x-tenant-id: own-sandbox`.

### 1a. Reaches MC with a real business response

| # | Test (`it` title) | Result |
|---|---|---|
| MC-1 | `GET /crossborder/balances` | ✅ 200 (real balances) |
| MC-2 | `POST /crossborder/quotes` (unique ref) | ✅ 200/201 — body contains `proposal`/`charged_amount` |
| MC-3 | `GET /crossborder/cash-pickup/countries?cash_pickup_type=PANY` (GET, no encryption) | ✅ reaches MC (not 404/500) |
| MC-4 | `GET /crossborder/endpoint-guide/specifications?...` (GET, no body/encryption) | ✅ reaches MC (not 404/500) |
| MC-5 | `POST /crossborder/carded-rates` (Carded Rate Pull — sandbox unsupported) | ✅ gateway proves out (not 500) |

### 1b. Validation / lookup endpoints — gateway contract (request reaches MC)

These POSTs require encryption in MTF/Prod, so the gateway contract is verified: the
route is mounted, the OAuth1 signature is applied, the request reaches MC and the
response is forwarded — asserted as **not 404** (route exists) and **not 500** (no
local crash).

| # | Test (`it` title) | Result |
|---|---|---|
| MC-6 | `POST /crossborder/address-validations` (sandbox test case) | ✅ reaches MC |
| MC-7 | `POST /crossborder/account-validations` (IBAN test case) | ✅ reaches MC |
| MC-8 | `POST /crossborder/bank-lookups` (sandbox test case) | ✅ reaches MC |
| MC-9 | `POST /crossborder/iban-generations` (sandbox test case) | ✅ reaches MC |

### 1c. RFI (Request For Information) group

| # | Test (`it` title) | Result |
|---|---|---|
| MC-10 | `GET /crossborder/rfi/requests/:id` (sandbox stub `33…` → OPEN, GET) | ✅ reaches MC (not 500) |
| MC-11 | `POST /crossborder/rfi/requests/:id` (update — needs encryption) | ✅ reaches MC (not 404/500) |
| MC-12 | `POST /crossborder/rfi/documents` (upload — needs encryption) | ✅ reaches MC (not 404/500) |
| MC-13 | `GET /crossborder/rfi/documents/:id` (download magic-id, error code `082000`) | ✅ reaches MC (not 500) |
| MC-14 | `POST /crossborder/rfi/documents` with a ~500KB file | ✅ **not 413** — route-scoped 2MB parser, not the global 256kb |

**MC response unwrapping** (common to all calls): 2xx → data; business 4xx with an
object body (`400/404/409/422/429`) → forward MC body; non-object 4xx body →
hidden, `502`; `401/403`/`5xx`/network/decrypt failure → `502` without leaking
details. (Pinned by `crossborder.service.spec` — see [tests-inner.md](./tests-inner.md).)

---

## 2. Inbound webhooks (Mastercard → us)

Direction **MC → us** (status push notifications). Does not call the MC API outbound.

| # | Test (`it` title) | Result |
|---|---|---|
| WH-1 | `POST /webhooks/mastercard` without a token | ✅ 401 (fail-closed) |
| WH-2 | `POST /webhooks/mastercard` with `x-webhook-token` | ✅ 200 |

> The webhook dedup-by-`eventRef` path (`kv_store`) is unit-pinned by
> `webhook.handler.spec` / `webhook-auth.guard.spec` — see [tests-inner.md](./tests-inner.md).
> Webhook authentication is the in-service fail-closed token (`X-Webhook-Token`),
> required in prod and dev. Mastercard's authoritative authenticity for push notifications
> is **mTLS** (not a payload signature; the former "C1" — details in `api.md` → Webhooks).

---

## Not covered (Mastercard)

- **Live JWE encryption** — the sandbox runs with FLE off, so the JWE encrypt/decrypt
  round-trip is not exercised end-to-end against MC (unit-pinned only). MTF/Prod requires
  the private Client Encryption key.
- **A fully-successful payment (2xx)** — requires the full KYC flow: quote →
  confirmation → payment with sender/recipient details.

---

## Tearing down the environment

```bash
# server — stop the node/ts-node process (Ctrl+C / Stop-Process on port 3000)
wsl -d Ubuntu -- bash -lc "cd /home/isaak/valeri/mastercard && docker compose down"   # -v to drop data
```
