# API — Mastercard Cross-Border Gateway

Reference for all HTTP endpoints. Related documents:
[documentation.md](./documentation.md) (entities), [tests.md](./tests.md)
(call examples), [architecture.md](./architecture.md) (design).

- **Base URL (dev):** `http://localhost:3000`
- **Format:** JSON (OAuth token also accepts `application/x-www-form-urlencoded`).
- **Interactive schema:** `GET /api-docs` (Swagger; disabled in prod unless `SWAGGER_ENABLED`).

---

## Authentication

Four independent methods — each endpoint group has its own:

| Header / method | Who | Where |
|---|---|---|
| `Authorization: Bearer <JWT>` | **external merchant** (partner) | `/crossborder/*` |
| `X-Internal-Token` + `X-Tenant-Id` | **internal** platform service/UI | `/crossborder/*` |
| `X-Admin-Token` | **platform operator** | `/admin/*` |
| mTLS at the ingress (dev: `X-Webhook-Token`) | **Mastercard** | `/webhooks/*` |
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

- **Authentication:** prod — **mTLS at the ingress**; dev — `X-Webhook-Token`.
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

The in-app throttler is per-pod (best-effort); the authoritative limit is at the
ingress. Exceeding it → `429`.
