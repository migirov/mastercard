# API — Mastercard Cross-Border Gateway

Reference for all HTTP endpoints. Related documents:
[documentation.md](./documentation.md) (entities), [tests.md](./tests.md)
(call examples), [architecture.md](./architecture.md) (design).

- **Base URL (dev):** `http://localhost:3000`
- **Format:** JSON (OAuth token also accepts `application/x-www-form-urlencoded`).
- **Interactive schema:** `GET /api-docs` (Swagger; disabled in prod unless `SWAGGER_ENABLED`).

---

## Mastercard API Reference — coverage

The full Mastercard Cross-Border **API Reference** (sidebar order) mapped onto this
gateway. Status: ✅ implemented · ⚠️ partial · ❌ not yet. Sandbox: ✅ available ·
⚠️ restricted (fixed test cases / needs encryption / partial) · ❌ not available.

| # | Mastercard API | Upstream MC endpoint(s) | Our gateway endpoint | Sandbox | Status |
|---|---|---|---|---|---|
| 1 | **Quotes API** | `POST /send/v1/partners/{pid}/crossborder/quotes` | `POST /crossborder/quotes` | ✅ | ✅ |
| 2 | **Quote Confirmation APIs** | `POST /send/partners/{pid}/crossborder/quotes/confirmations` | `POST /crossborder/quotes/confirmations` | ✅ | ✅ |
| 3 | **Carded Rate Pull + Push** | Pull `POST /send/v1/partners/{pid}/crossborder/rates`; Push = customer-hosted webhook | — | ❌ | ❌ (opt-in) |
| 4 | **Payment API** | `POST /send/v1/partners/{pid}/crossborder/payment` | `POST /crossborder/payments` | ✅ | ✅ |
| 5 | **Address Validation API** | `POST /send/address-validation-service/addresses/validations` | `POST /crossborder/address-validations` | ⚠️ (needs payload encryption) | ✅ |
| 6 | **Account Validation APIs** (suite ×3) | `POST …/crossborder/accounts/validations`; `POST …/crossborder/banks/details` (Bank Lookup); `POST …/crossborder/accounts/generate-ibans` (IBAN Gen) | `POST /crossborder/account-validations`, `/bank-lookups`, `/iban-generations` | ⚠️ (needs encryption; ASV not in sandbox) | ✅ |
| 7 | **Cash Pickup Locations API** | `GET /crossborder/cash-pickup/{countries,cities,providers,branches}` | — | ✅ | ❌ (opt-in) |
| 8 | **Endpoint Guide API** | `GET /crossborder/endpoint-guide/specifications` | — | ✅ (generic) | ❌ |
| 9 | **Status Change Push** | MC → our webhook (push) | `POST /webhooks/mastercard` | ✅ | ✅ (receiver) |
| 10 | **Retrieve Payment API** | `GET /send/v1/partners/{pid}/crossborder/{id}` · `…?ref=` | `GET /crossborder/payments/:id` · `?ref=` | ✅ | ✅ |
| 11 | **RFI APIs** (suite) | `GET/POST …/crossborder/rfi/requests/{id}`, `…/rfi/documents[/{id}]`, push webhook | — | ⚠️ (push N/A; rest fixed cases) | ❌ |
| 12 | **Cancel Payment API** | `POST /send/v1/partners/{pid}/crossborder/{id}/cancel` | `POST /crossborder/payments/:id/cancel` | ✅ | ✅ |
| 13 | **Balance API** | `GET /send/partners/{pid}/crossborder/accounts?include_balance=true` | `GET /crossborder/balances` | ✅ | ✅ |
| 14 | **Payload Encryption** | JWE (RSA-OAEP-256 + A256GCM) | `EncryptionService` (axios interceptor) | ❌ (FLE only in MTF/Prod) | ✅ |
| 15 | **Push Notifications Details** | inbound webhook infra + dedup | `POST /webhooks/mastercard` | ✅ | ⚠️ (receiver done; signature pending C1) |

**Implemented (10 + 1 partial):** 1, 2, 4, **5**, **6**, 9, 10, 12, 13, 14 (+15 partial).
**Not yet (4 groups):** Carded Rate (3), Cash Pickup (7), Endpoint Guide (8), RFI (11) —
all auxiliary/opt-in MC services.

> **Address Validation (5)** and **Account Validation (6)** are implemented as passthroughs but
> **cannot be verified live on our sandbox**: MC requires the payload to be JWE-encrypted, and
> field-level encryption is disabled in sandbox (plain → MC `062000 INVALID_INPUT_FORMAT` for
> address, `150001` "Encrypted Payload" SYSTEM_ERROR for account). The gateway wiring is e2e-
> verified (route, OAuth1 signature, required `X-Mc-Correlation-Id`/`Partner-Ref-Id` headers,
> error forwarding); the body is auto-encrypted by the request interceptor in MTF/Prod.
> Several other groups likewise have **no sandbox** (Carded Rate) or fixed test cases only.

> Extra we already expose beyond the screenshot list: `GET /crossborder/rates` (generic FX rates).
> MC path prefixes are inconsistent (per the official doc): `/send/v1/…` for quotes/payment/
> carded-rate/retrieve/cancel; `/send/…` (no `v1`) for confirmations/account-validation/RFI;
> `/crossborder/…` (no `/send`, no partner path) for cash-pickup/endpoint-guide; Address
> Validation uses a dedicated `/send/address-validation-service/…` base.

---

## Authentication

Four independent methods — each endpoint group has its own:

| Header / method | Who | Where |
|---|---|---|
| `Authorization: Bearer <JWT>` | **external merchant** (partner) | `/crossborder/*` |
| `X-Internal-Token` + `X-Tenant-Id` | **internal** platform service/UI | `/crossborder/*` |
| `X-Admin-Token` | **platform operator** | `/admin/*` |
| in-service `X-Webhook-Token` (fail-closed; mTLS at the ingress is optional, additional) | **Mastercard** | `/webhooks/*` |
| — (public) | anyone with client_id/secret | `/oauth/token` |

**Important:** `tenantId` is NEVER taken from the body/query — only from
authentication (external merchant JWT or the internal call's `X-Tenant-Id`).

### Obtaining a merchant token

```
POST /oauth/token            (public — it is itself the authentication point)
```
Body (`form-urlencoded` or JSON), grant `client_credentials`:

| Field | Description |
|---|---|
| `grant_type` | always `client_credentials` |
| `client_id` | issued by the admin API (`mc_…`) |
| `client_secret` | issued by the admin API (shown once) |

`client_id`/`secret` may also be passed via `Authorization: Basic`. Response:
```json
{ "access_token": "<JWT>", "token_type": "Bearer", "expires_in": 900 }
```
The JWT lives 15 min, HS256, `tid` = tenantId. Rate-limit: **10/min by `client_id`**.
Errors: `400 unsupported_grant_type`, `401 invalid_client`.

---

## Cross-Border API (merchant business operations)

Group `/crossborder/*`. Auth — Bearer JWT (external) **or** `X-Internal-Token` +
`X-Tenant-Id` (internal). Available **only to an active tenant** (dual approval,
otherwise `403`). Rate-limit: **120/min per tenant**. Each request is OAuth1-signed
with the tenant's keys and (in MTF/Prod) JWE-encrypted — transparently.

| Method | Path | What it does | Upstream Mastercard |
|---|---|---|---|
| `GET` | `/crossborder/balances` | Partner accounts and balances | `GET …/crossborder/accounts?include_balance=true` |
| `GET` | `/crossborder/rates` | Available FX rates | `GET …/crossborder/rates` |
| `POST` | `/crossborder/quotes` | Request a quote (transfer price/rate) | `POST …/crossborder/quotes` |
| `POST` | `/crossborder/quotes/confirmations` | Confirm a quote | `POST …/crossborder/quotes/confirmations` |
| `POST` | `/crossborder/payments` | Initiate a payment | `POST …/crossborder/payment` |
| `GET` | `/crossborder/payments/:id` | Payment status by id | `GET …/crossborder/{id}` |
| `GET` | `/crossborder/payments?ref=…` | Payment status by transaction reference | `GET …/crossborder?ref=…` |
| `POST` | `/crossborder/payments/:id/cancel` | Cancel a payment | `POST …/crossborder/{id}/cancel` |

`…` = `/send[/v1]/partners/{partner-id}/crossborder` — `partner-id` comes from the
tenant's credentials (not from the request).

### Typical transfer flow

```
1. POST /crossborder/quotes              → proposal with price/rate
2. POST /crossborder/quotes/confirmations → confirm the chosen proposal
3. POST /crossborder/payments            → initiate the payment (+ Idempotency-Key)
4. GET  /crossborder/payments/:id        → poll status (or wait for a webhook)
```

### POST /crossborder/quotes

Body — a JSON object (passed through to Mastercard; the gateway does not trim it). Example:
```json
{
  "quoterequest": {
    "transaction_reference": "08POC342598033X",
    "sender_account_uri": "tel:+25406005",
    "recipient_account_uri": "tel:+254069832",
    "payment_amount": { "amount": "105.15", "currency": "USD" },
    "payment_origination_country": "USA",
    "payment_type": "P2P",
    "quote_type": { "forward": { "receiver_currency": "GBP" } }
  }
}
```
Response **201** — a real MC proposal:
```json
{ "quote": { "transaction_reference": "08POC342598033X", "payment_type": "P2P",
  "proposals": { "proposal": [ {
    "id": "pen-4000000044472562338287758",
    "charged_amount":   { "amount": "110.41", "currency": "USD" },
    "principal_amount": { "amount": "105.15", "currency": "USD" },
    "expiration_date": "2026-06-11T00:42:08-05:00",
    "quote_fx_rate": "777" } ] } } }
```

### POST /crossborder/payments

Body — a JSON object. Optional header **`Idempotency-Key`** (recommended): the same
key → the same result, without calling MC again (protection against double charges
on retry). Key: up to 128 chars from `[A-Za-z0-9._-:]`. The MC-side backstop is
`transaction_reference`.

### Response semantics (how the gateway unwraps MC)

| What Mastercard returned | What the merchant gets |
|---|---|
| 2xx | data (decrypted if it was encrypted) |
| business 4xx (`400/404/409/422/429`) | **forward** the MC status and body as-is |
| `401/403` (our credentials) / `5xx` / non-JSON | `502`, no details leaked (details → log) |
| network error / decryption failure | `502` |

Example forwarded MC error (HTTP 400):
```json
{ "Errors": { "Error": { "Source": "transaction_reference",
  "ReasonCode": "DECLINE", "Description": "Duplicate Transaction Reference Number" } } }
```
Local validation errors (gateway, before MC): `400` with an English message, e.g.
`{"message":"Quote body must be a JSON object","statusCode":400}`.

---

## Admin API (platform operator)

Group `/admin/*`. Auth — `X-Admin-Token`. Manages partners and their access.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/admin/tenants` | List of partners (no `secretRef`, with `status`) |
| `GET` | `/admin/tenants/:id` | A single partner |
| `POST` | `/admin/tenants` | Create a partner (starts in `PENDING`) |
| `POST` | `/admin/tenants/:id/approve/platform` | Approval from the platform |
| `POST` | `/admin/tenants/:id/approve/mastercard` | Approval from Mastercard |
| `POST` | `/admin/tenants/:id/suspend` | Suspend (overrides approvals) |
| `POST` | `/admin/tenants/:id/unsuspend` | Lift the suspension |
| `POST` | `/admin/tenants/:id/clients` | Issue an OAuth client to the partner |
| `DELETE` | `/admin/clients/:clientId` | Revoke an OAuth client |
| `GET` | `/admin/audit` | Operation log (last 200) |

A partner becomes `ACTIVE` (transactions allowed) only with **both** approvals and
no suspension.

### POST /admin/tenants — body (`CreateTenantDto`)

| Field | Rule |
|---|---|
| `name` | string, ≤120, required |
| `credentialMode` | `PLATFORM` \| `OWN`, required |
| `id` | string, ≤64, optional (otherwise generated `t_…`) |
| `partnerId` | string, ≤128, optional |
| `secretRef` | string, ≤256; required for `OWN` |

### POST /admin/tenants/:id/clients — response

```json
{ "clientId": "mc_RPVCa4sGrL2O", "clientSecret": "<32 chars>",
  "note": "client_secret shown once — save it now" }
```
**`clientSecret` is shown ONCE** (only a hash is stored in the DB).

---

## Webhooks (inbound from Mastercard)

| Method | Path | What it does |
|---|---|---|
| `POST` | `/webhooks/mastercard` | Receive push notifications (transaction statuses, etc.) |

- **Authentication:** in-service fail-closed token (`X-Webhook-Token`), required in prod and dev; JWS/HMAC signature verification is the planned authoritative factor (pending MC spec, C1). mTLS at the ingress is optional, additional — not the authentication.
- **Always responds `200`** (otherwise MC retries).
- **Dedup** by `eventRef` (MC retries up to 3 times): repeat → `{"status":"duplicate"}`,
  otherwise `{"status":"accepted"}`.

---

## Service

| Method | Path | What it does |
|---|---|---|
| `GET` | `/health` | **Liveness** (k8s): process is alive → `200 {"status":"ok"}`. No auth. |
| `GET` | `/ready` | **Readiness** (k8s): ready to serve (Postgres ping) → `200`/`503`. No auth. |
| `GET` | `/api-docs` | Swagger UI (disabled in production without `SWAGGER_ENABLED`) |

---

## Rate-limit summary

| Group | Limit | Key |
|---|---|---|
| `/crossborder/*` | 120 / min | `tenantId` (fail-closed) |
| `/oauth/token` | 10 / min | `client_id` (not bypassable by IP rotation) |
| `/admin/*` | 120 / min | IP |

Rate-limiting is a self-standing per-pod `@nestjs/throttler` (correctness independent of the ingress); an ingress limit, if any, is optional defense-in-depth, not authoritative. Exceeding it → `429`.
