# Tests — Mastercard integration

Tests for everything **related to Mastercard**: outbound calls to the Cross-Border
API (`sandbox.api.mastercard.com`) and inbound webhooks (MC → us). Internal gateway
tests (auth, gating, reliability, infra) are in [tests-inner.md](./tests-inner.md).

Related: [api.md](./api.md), [architecture.md](./architecture.md),
[documentation.md](./documentation.md).

> `$base = http://localhost:3000`. Checks use `curl.exe` (prints status via
> `-w "HTTP %{http_code}"`).

---

## Environment

- **OS:** Windows 10 + project on WSL (Ubuntu), UNC path `\\wsl.localhost\Ubuntu\home\isaak\valeri\mastercard`.
- **Node:** Windows node (no node inside WSL). Docker/git run inside WSL (`wsl -d Ubuntu ...`).
- **PostgreSQL:** Docker inside WSL; reachable from Windows at `localhost:5432`.
- **Mastercard:** sandbox (`https://sandbox.api.mastercard.com`), encryption disabled
  (`MC_ENCRYPTION_ENABLED=false` — sandbox does not support FLE, runs plain).
- **Tenant for MC calls:** `own-sandbox` (OWN/ACTIVE, keys from LocalSecretStore,
  `partner-id` = `SANDBOX_1234567`).

```bash
# Postgres + server
wsl -d Ubuntu -- bash -lc "cd /home/isaak/valeri/mastercard && docker compose up -d"
cmd /c "pushd \\wsl.localhost\Ubuntu\home\isaak\valeri\mastercard && npx ts-node src/main.ts & popd"
```

---

## 1. Outbound calls to the Mastercard Cross-Border API

**Only these tests actually go out to `sandbox.api.mastercard.com`.** Each path:
auth → resolve tenant → OWN credentials from SecretStore → **OAuth1 signature** →
HTTPS to MC → unwrap response. (In MTF/Prod, JWE body encryption is added — plain
in sandbox.)

| # | Test | Expected | Result |
|---|---|---|---|
| MC-1 | `GET /crossborder/balances` (internal, own-sandbox) | 200 + real balances | ✅ 200 (USD/JPY/BHD) |
| MC-2 | `GET /crossborder/balances` with Bearer JWT (external path) | 200 + real balances | ✅ 200 |
| MC-3 | `GET /crossborder/rates` | 200 | ✅ 200 `{"rates":{}}` |
| MC-4 | `POST /crossborder/quotes` (unique ref) | 201 + MC proposal | ✅ 201, real proposal |
| MC-5 | `POST /crossborder/quotes` (used ref) | forward MC business error | ✅ 400 `Duplicate Transaction Reference` |
| MC-6 | `POST /crossborder/payments` (incomplete body) | forward MC error | ✅ 400 `MISSING_REQUIRED_INPUT` (MC processed it, RequestId present) |

### MC-1 / MC-2 — Balances (real MC)

```bash
curl.exe -s -H "X-Internal-Token: ..." -H "X-Tenant-Id: own-sandbox" $base/crossborder/balances
```
**HTTP 200** — real Mastercard sandbox response (3 accounts):
```json
[ {"accountId":"acct_1001","settlementCurrency":"USD",
   "balanceDetails":{"availableBalance":{"amount":"8000.50","currency":"USD"}, ...}},
  {"accountId":"acct_1002","settlementCurrency":"JPY", ...},
  {"accountId":"acct_1003","settlementCurrency":"BHD", ...} ]
```
**MC-2** — same via the external path (`Authorization: Bearer <JWT>`) → also 200.
Proves the whole stack: auth → OWN credentials → **OAuth1 signature** → real MC call.

### MC-3 — FX rates

```bash
curl.exe -s -H "X-Internal-Token: ..." -H "X-Tenant-Id: own-sandbox" $base/crossborder/rates
# HTTP 200  {"rates":{}}
```

### MC-4 — Quote, success (201)

```bash
# body: {"quoterequest":{"transaction_reference":"<unique>",
#   "sender_account_uri":"tel:+25406005","recipient_account_uri":"tel:+254069832",
#   "payment_amount":{"amount":"105.15","currency":"USD"},
#   "payment_origination_country":"USA","payment_type":"P2P",
#   "quote_type":{"forward":{"receiver_currency":"GBP"}}}}
curl.exe -s -X POST -H "X-Internal-Token: ..." -H "X-Tenant-Id: own-sandbox" \
  -H "Content-Type: application/json" --data-binary "@quote.json" $base/crossborder/quotes
```
**HTTP 201** — real MC proposal:
```json
{"quote":{"transaction_reference":"08POC342598033X","payment_type":"P2P",
 "proposals":{"proposal":[{"id":"pen-4000000044472562338287758",
   "charged_amount":{"amount":"110.41","currency":"USD"},
   "principal_amount":{"amount":"105.15","currency":"USD"},"quote_fx_rate":"777"}]}}}
```

### MC-5 — Quote, used ref (forwarded MC error)

**HTTP 400** — MC error forwarded to the client as-is (signature accepted, MC processed it):
```json
{"Errors":{"Error":{"Source":"transaction_reference","ReasonCode":"DECLINE",
 "Description":"Duplicate Transaction Reference Number","Details":{"Detail":{"Value":"130202"}}}}}
```

### MC-6 — Payment reaches MC

A payment with an incomplete body → MC returns the list of required KYC fields (a
RequestId is assigned → the request actually reached and was processed):
```json
{"Errors":{"Error":[{"Source":"sender.first_name","ReasonCode":"MISSING_REQUIRED_INPUT", ...}, ...]}}
```

**MC response unwrapping** (common to all calls above): 2xx → data; business 4xx
(`400/404/409/422/429`) → forward MC body; `401/403`/`5xx`/network → `502` without
leaking details.

---

## 2. Inbound webhooks (Mastercard → us)

Direction **MC → us** (status push notifications). Does not call the MC API outbound.

| # | Test | Result |
|---|---|---|
| WH-1 | `POST /webhooks/mastercard` first time | ✅ 200 `{"status":"accepted"}` |
| WH-2 | repeat with same `eventRef` | ✅ 200 `{"status":"duplicate"}` (dedup via `kv_store`) |
| WH-3 | wrong `X-Webhook-Token` | ✅ 401 `invalid webhook token` |

```bash
WH=(-H "X-Webhook-Token: dev-webhook-token-change-me" -H "Content-Type: application/json")
B='{"eventRef":"evt-test-001","eventType":"STATUS_CHG"}'
curl.exe -s "${WH[@]}" -d "$B" $base/webhooks/mastercard   # accepted
curl.exe -s "${WH[@]}" -d "$B" $base/webhooks/mastercard   # duplicate
```
> Webhook authentication is the in-service fail-closed token (`X-Webhook-Token`),
> required in prod and dev. mTLS at the ingress is optional, additional — not the authentication.

---

## Not covered (Mastercard)

- **Encryption (JWE)** — MTF/Prod only (sandbox lacks FLE + the per-tenant
  encryption blocker); requires the private Client Encryption key.
- **Successful payment (2xx)** — requires the full KYC flow: quote → confirmation →
  payment with sender/recipient details.

---

## Tearing down the environment

```bash
# server — stop the node/ts-node process (Ctrl+C / Stop-Process on port 3000)
wsl -d Ubuntu -- bash -lc "cd /home/isaak/valeri/mastercard && docker compose down"   # -v to drop data
```
