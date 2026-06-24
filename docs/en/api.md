# API — Mastercard Cross-Border Gateway

Reference for every HTTP endpoint of the gateway, one section per endpoint. Related
docs: [documentation.md](./documentation.md) (entities / data design),
[architecture.md](./architecture.md) (design),
[api-mastercard.md](./api-mastercard.md) (original Mastercard docs).

- **Base URL (dev):** `http://localhost:3000`
- **Format:** JSON (`POST /oauth/token` also accepts `application/x-www-form-urlencoded`).
- **Interactive schema:** `GET /api-docs` (Swagger; disabled in prod without `SWAGGER_ENABLED`).
  That is an **auto-schema from decorators**; the human-facing source of truth is this file.

## How to read an endpoint section

Each endpoint follows one template: **Purpose** · **Method/path** · **Upstream MC**
(where the gateway calls Mastercard) · **Auth** · **Encryption (FLE)** · **Params/body**
· **Response** (with a real sandbox example where available) · **Notes/sandbox**.

Rules common to all endpoints live in [“Cross-cutting rules”](#cross-cutting-rules); they
are not repeated per endpoint.

---

## Mastercard API Reference coverage map

The 15 Mastercard Cross-Border **API Reference** groups → our routes. ✅ implemented ·
⚠️ external sandbox limit. Details in the sections below.

| # | Mastercard API | Our route | Sandbox |
|---|---|---|---|
| 1 | Quotes | `POST /crossborder/quotes` | ✅ real proposal |
| 2 | Quote Confirmation (×3) | `POST /quotes/confirmations`, `/quotes/cancellations`, `GET /quotes/:ref/proposals/:id` | ✅ |
| 3 | Carded Rate Pull + Push | `GET /crossborder/rates` (+ push webhook) | ⚠️ no MC sandbox data |
| 4 | Payment | `POST /crossborder/payments` | ✅ (full success needs the KYC flow) |
| 5 | Address Validation | `POST /crossborder/address-validations` | ✅ FLE → `VALID/VERIFIED` |
| 6 | Account Validation (×3) | `POST /account-validations`, `/bank-lookups`, `/iban-generations` | ✅ FLE → real data |
| 7 | Cash Pickup Locations | `GET /crossborder/cash-pickup/{countries,cities,providers,branches}` | ✅ |
| 8 | Endpoint Guide | `GET /crossborder/endpoint-guide/specifications` | ⚠️ HTML-500 (corridor after onboarding) |
| 9 | Status Change Push | `POST /webhooks/mastercard` → `GET /crossborder/status-events` | ✅ |
| 10 | Retrieve Payment | `GET /crossborder/payments/:id` · `?ref=` | ✅ |
| 11 | RFI (×4) | `GET/POST /rfi/requests/:id`, `POST /rfi/documents`, `GET /rfi/documents/:id` | ⚠️ `050007` (RFI not enabled for the project) |
| 12 | Cancel Payment | `POST /crossborder/payments/:id/cancel` | ✅ |
| 13 | Balance | `GET /crossborder/balances` | ✅ real balances |
| 14 | Payload Encryption | `EncryptionService` (axios interceptor) | ✅ FLE works on sandbox |
| 15 | Push Notifications | `POST /webhooks/mastercard` (+ `tx_status`) | ✅ |

> “Reference Application” in MC’s sidebar is a sample app, not an API; nothing to implement.

---

## Cross-cutting rules

### Authentication — 4 independent methods

| Header / method | Who | Where |
|---|---|---|
| `Authorization: Bearer <JWT>` | external merchant (partner) | `/crossborder/*` |
| `X-Internal-Token` + `X-Tenant-Id` | internal platform service/UI | `/crossborder/*` |
| `X-Admin-Token` | platform operator | `/admin/*` |
| `X-Webhook-Token` (fail-closed; authority at MC = **mTLS**, the token is our extra factor) | Mastercard | `/webhooks/*` |
| — (public) | anyone with `client_id`/`secret` | `/oauth/token` |

**`tenantId` is NEVER taken from the body/query** — only from authentication (the external
merchant’s JWT or the internal call’s `X-Tenant-Id`). All `/crossborder/*` are available
**only to an active tenant** (dual approval, otherwise `403`).

### Response semantics (how the gateway unwraps Mastercard)

| What Mastercard returned | What the merchant gets |
|---|---|
| `2xx` | data (decrypted if it was encrypted) |
| business `4xx` (`400/404/409/422/429`) with a JSON object | **forward** MC’s status and body as-is (under the `upstream` key) |
| `401/403` (our creds) / `5xx` / non-object body | `502` with no detail leaked (detail → log) |
| network error / decrypt failure | `502` |

Example of a forwarded business error from MC (`400`):
```json
{ "error": "Upstream Error", "message": "Mastercard returned an error",
  "upstream": { "Errors": { "Error": [ {
    "Source": "transaction_reference", "ReasonCode": "DECLINE",
    "Description": "Duplicate Transaction Reference Number" } ] } } }
```
Local validation errors (gateway, before MC) — `400` with an English message, e.g.
`{"statusCode":400,"message":"Invalid UUID identifier"}`.

### Encryption (FLE — field-level encryption)

JWE (RSA-OAEP-256 + A256GCM), implemented as an **axios interceptor inside `MastercardClient`**
(not a NestJS interceptor), on every outbound MC call. Driven by the global toggle
`MC_ENCRYPTION_ENABLED`:
- **request:** when the toggle is on, the **whole non-empty body** is wrapped into
  `{ encrypted_payload: { data: <JWE> } }` and then OAuth1-signed **over the encrypted body**.
  Encrypted with the **Client Encryption Key** (MC public cert; MC holds the private key).
- **response:** decrypted with our **Mastercard Encryption private key** if MC sent
  `encrypted_payload.data`.
- **FLE works on sandbox** (proven live 2026-06-16). The old belief “sandbox doesn’t support
  FLE” was a key-selection mistake (`082000 Crypto Key`). Key details — `production-questions.md`.
- In practice: **POST with a body** (quotes/validations/bank-lookup/iban/payment/confirm/RFI
  update/upload) → body encrypted; **GET catalogs** (balances/rates/cash-pickup/endpoint-guide/
  RFI retrieve/download) send no body → nothing to encrypt. Per-tenant keys (OWN with their own)
  are wired — `EncryptionService` builds a per-tenant `JweEncryption` by fingerprint; live
  cross-tenant validation with real keys remains on MTF.

### Boundary validation (pipes)

| Pipe | What it enforces | Where |
|---|---|---|
| `SafeIdPipe` | non-empty string with no `/`,`\`,whitespace,`..` (anti path-traversal) | id/ref in MC path |
| `UuidParamPipe` | strict RFC-4122 UUID (v1–5 + variant) | RFI `request_id`/`document_id` |
| `StringQueryPipe` | optional; rejects non-string (duplicate query keys) | catalog query params |
| `gatewayValidationPipe(Passthrough)` | soft: validates declared fields, does NOT strip unknown, does NOT coerce types (MC amounts are strings) | MC-bound bodies |
| `gatewayValidationPipe(Strict)` | strict: `whitelist`+`forbidNonWhitelisted`+`transform` | admin/oauth bodies |

There is NO global `ValidationPipe` — each controller declares its own (so strict validation
of our boundaries doesn’t strip MC passthrough fields). `helmet`; JSON limit **256 kb**
(exception — RFI upload, see below).

---

# Cross-Border API (merchant business operations)

Group `/crossborder/*`. Auth — `TenantAuthGuard` (Bearer JWT **or** `X-Internal-Token` +
`X-Tenant-Id`). Active tenant only. Rate-limit **120/min per tenant**. Every request is
OAuth1-signed with the tenant’s keys; the body (if any) is JWE-encrypted — transparently.
`partner-id` is taken from the tenant’s credentials (not from the request).

### Typical transfer flow
```
1. POST /crossborder/quotes               → proposal with price/rate
2. POST /crossborder/quotes/confirmations → confirm the chosen proposal
3. POST /crossborder/payments             → initiate the payment (idempotency by transaction_reference)
4. GET  /crossborder/payments/:id         → poll status (or wait for the webhook)
```

## Quotes & Payments

### POST /crossborder/quotes
**Purpose.** Request a quote (transfer price/rate). · **Upstream:** `POST /send/v1/partners/{pid}/crossborder/quotes` · **Auth:** tenant · **FLE:** yes · **Code:** `200` (`@HttpCode(200)` — a computation, not resource creation).

Body — `QuoteRequestDto` (passthrough; unknown MC fields kept). Critical fields validated as
strings (MC amounts are strings, not numbers):
```json
{ "quoterequest": {
  "transaction_reference": "08POC342598033X",
  "sender_account_uri": "tel:+25406005",
  "recipient_account_uri": "tel:+254069832",
  "payment_amount": { "amount": "105.15", "currency": "USD" },
  "payment_origination_country": "USA",
  "payment_type": "P2P",
  "quote_type": { "forward": { "receiver_currency": "GBP" } } } }
```
Response `200` — a real MC proposal:
```json
{ "quote": { "transaction_reference": "08POC342598033X", "payment_type": "P2P",
  "proposals": { "proposal": [ {
    "id": "pen-4000000044472562338287758",
    "charged_amount":   { "amount": "110.41", "currency": "USD" },
    "principal_amount": { "amount": "105.15", "currency": "USD" },
    "expiration_date": "2026-06-11T00:42:08-05:00",
    "quote_fx_rate": "777" } ] } } }
```

### POST /crossborder/quotes/confirmations
**Purpose.** Confirm the chosen quote proposal. · **Upstream:** `POST /send/partners/{pid}/crossborder/quotes/confirmations` · **Auth:** tenant · **FLE:** yes · **Code:** `200`.

Body — `ConfirmationRequestDto` (passthrough): `transactionReference?`, `proposalId?` (both strings).

### POST /crossborder/quotes/cancellations
**Purpose.** Cancel a confirmed quote (release the reservation). · **Upstream:** `POST /send/partners/{pid}/crossborder/quotes/cancellations` · **Auth:** tenant · **FLE:** yes · **Code:** `200`.

Body — `ConfirmationRequestDto` (same as confirmations).

### GET /crossborder/quotes/:transactionReference/proposals/:proposalId
**Purpose.** Retrieve a confirmed quote. · **Upstream:** `GET /send/partners/{pid}/crossborder/quotes/{ref}/proposals/{proposalId}` · **Auth:** tenant · **FLE:** no body.

Path params `transactionReference`, `proposalId` — both `SafeIdPipe`.

### POST /crossborder/payments
**Purpose.** Initiate a payment. · **Upstream:** `POST /send/v1/partners/{pid}/crossborder/payment` · **Auth:** tenant · **FLE:** yes · **Code:** `201` (resource creation).

Body — `PaymentRequestDto` (passthrough, `paymentrequest` wrapper, amounts are strings).
**Idempotency is keyed on `transaction_reference`** (a required body field), with the source of
truth in **Postgres** (`payment_idempotency`, `UNIQUE(tenantId, idemKey)`; no separate KV layer):
a retry with the same `transaction_reference` → the same result without re-calling MC
(guards against double charges); a request already in progress → `409`; the same ref with a
DIFFERENT body (fingerprint) → `422`. The key is hashed (`idemKey = txref:sha256(ref)`). There is
no `Idempotency-Key` header. Completed records are permanent (one
`transaction_reference` = one payment forever).

### GET /crossborder/payments/:id
**Purpose.** Payment status by id. · **Upstream:** `GET /send/v1/partners/{pid}/crossborder/{id}` · **Auth:** tenant · **FLE:** no body. Param `id` — `SafeIdPipe`.

### GET /crossborder/payments?ref=…
**Purpose.** Payment status by `transaction_reference`. · **Upstream:** `GET /send/v1/partners/{pid}/crossborder?ref={ref}` · **Auth:** tenant. Query `ref` (required) — `SafeIdPipe`. A lookup, not a list.

### POST /crossborder/payments/:id/cancel
**Purpose.** Cancel a payment. · **Upstream:** `POST /send/v1/partners/{pid}/crossborder/{id}/cancel` · **Auth:** tenant · **FLE:** no body sent · **Code:** `200`. Param `id` — `SafeIdPipe`.

### GET /crossborder/status-events?ref=…
**Purpose.** Stored push statuses by `transaction_reference`. · **Upstream:** **no MC call** — local read from the `tx_status` table. · **Auth:** tenant. Query `ref` (required) — `SafeIdPipe`.

Tenant-scoped: OWN sees strictly its own events; PLATFORM — its own + the shared pool by ref.
Response — an array of `StatusEventViewDto`: `transactionReference`, `eventType`,
`transactionType`, `status`, `stage`, `receivedAt`, `payload` (internal `id`/`tenantId` not exposed).

## Rates

### GET /crossborder/rates
**Purpose.** Carded / FX Rate Pull (corridor rates, MC operation `getFxRates`). · **Upstream:** `GET /send/v1/partners/{pid}/crossborder/rates` (no body) · **Auth:** tenant · **FLE:** no body.

⚠️ **MC provides no sandbox data for Carded Rate** → no real response in sandbox; e2e only checks
that the gateway doesn’t crash and forwards. Sandbox returns `{"rates":{}}`. The push variant is
a webhook (`CARDFX_PUB`) on the shared `/webhooks/mastercard`. Verifiable live in MTF/Prod on a
configured corridor.

## Validation / Lookup (FLE)

All 4 are `POST` with an encrypted body, returning **real data** on sandbox (FLE works).
Documented sandbox test cases (fixed addresses/IBAN/BIC/BAN) — in `api-mastercard.md`.

### POST /crossborder/address-validations
**Purpose.** Validate and normalize an address. · **Upstream:** `POST /send/address-validation-service/addresses/validations` (own base, no partner-id in path) · **Auth:** tenant · **FLE:** yes · **Code:** `200`.

Body — `AddressValidationRequestDto` (`country`, `address` — required):
```json
{ "country": "USA", "address": "4 CLARK STREET, EVERETT, MA, 02149" }
```
Response `200` (real sandbox):
```json
{ "status": "VALID", "verification": "VERIFIED",
  "addressMatch": { "address": "4 Clark St,Everett MA 02149-2015",
    "line1": "4 Clark St", "country": "USA", "countrySubdivision": "MA",
    "city": "Everett", "streetName": "Clark St", "buildingNumber": "4",
    "postalCode": "02149-2015" } }
```

### POST /crossborder/account-validations
**Purpose.** Validate the recipient account (IBAN/BAN) + bank data. · **Upstream:** `POST /send/partners/{pid}/crossborder/accounts/validations` · **Auth:** tenant · **FLE:** yes · **Code:** `200`.

Body — `AccountValidationRequestDto`: `accountUri` (required, `{type,value}`), `requestType?`
(`CES`|`ASV`; the ASV type is N/A in sandbox):
```json
{ "accountUri": { "type": "IBAN", "value": "FR070331234567890123456" } }
```
Response `200` (real sandbox):
```json
{ "status": "SUCCESS", "message": "Valid IBAN Structure",
  "accountMatch": { "accounts": { "account": [
      { "type": "IBAN", "value": "FR070331234567890123456" },
      { "type": "BAN",  "value": "30007999990424173200040" } ] },
    "bank": { "bic": { "type": "SWIFT BIC", "value": "NATXFRPP" },
      "name": "Natixis", "branchCode": "3000799999",
      "address": { "city": "Paris", "postalCode": "75013", "country": "FRA" } } } }
```

### POST /crossborder/bank-lookups
**Purpose.** Look up a bank by name/country/BIC. · **Upstream:** `POST /send/partners/{pid}/crossborder/banks/details` · **Auth:** tenant · **FLE:** yes · **Code:** `200`.

Body — `BankLookupRequestDto` (`bank` wrapper, required):
```json
{ "bank": { "name": "*of Africa United Kingdom*SUC20004", "country": "GBR",
            "bic": { "type": null, "value": null } } }
```
Response `200` (real sandbox): `{ "bankInfo": { "total": "4", "banks": { "bankData": [ … ] } } }`
with an array of banks (BIC, name, branch, address, sanctionDetails).

### POST /crossborder/iban-generations
**Purpose.** Generate an IBAN from a BAN/details. · **Upstream:** `POST /send/partners/{pid}/crossborder/accounts/generate-ibans` · **Auth:** tenant · **FLE:** yes · **Code:** `200`.

Body — `IbanGenerationRequestDto` (optional fields: `accountUri?`, `country?`, `branchCode?`, `accountNo?`):
```json
{ "accountUri": { "type": "ban", "value": "20041010050500013M02606" },
  "country": "FRA", "branchCode": "2004101005", "accountNo": "0500013026" }
```
Response `200` (real sandbox):
```json
{ "ibanDetails": { "accounts": { "account": [
      { "type": "IBAN", "value": "FR1420041010050500013M02606" },
      { "type": "BAN",  "value": "20041010050500013M02606" } ] },
    "bank": { "bic": { "value": "PSSTFRPPLIL" }, "name": "La Banque Postale",
      "branchCode": "2004101005", "address": { "city": "Lille", "country": "FRA" } } } }
```

## Cash Pickup Locations

Cash pickup catalogs. · **Upstream:** `GET /crossborder/cash-pickup/{type}{?query}` (no `/send`,
**partner-id in the `partner-id` HEADER**) · **Auth:** tenant · **FLE:** no body. All query params — `StringQueryPipe` (optional).

| Route | Query |
|---|---|
| `GET /crossborder/cash-pickup/countries` | `cash_pickup_type?` |
| `GET /crossborder/cash-pickup/cities` | `country?`, `currency?`, `offset?`, `limit?` |
| `GET /crossborder/cash-pickup/providers` | `country?`, `currency?`, `cash_pickup_type?`, `offset?`, `limit?` |
| `GET /crossborder/cash-pickup/branches` | `provider_id?`, `state?`, `city?`, `offset?`, `limit?` |

Response for `countries` (real sandbox): `[{"items":[{"countryAlpha3":"NGA","currency":"NGN","cashPickupType":"PANY"}, … ]}]`.

## Endpoint Guide

### GET /crossborder/endpoint-guide/specifications
**Purpose.** Corridor rules/requirements (fields, limits). · **Upstream:** `GET /crossborder/endpoint-guide/specifications{?query}` (partner-id in header) · **Auth:** tenant · **FLE:** no body. Query (`StringQueryPipe`): `payment_type?`, `destination_country?`, `destination_currency?`, `destination_payment_instrument?`.

⚠️ **Sandbox** returns an **HTML 500 page** (Tomcat) for the generic partner-id — corridor specs
are only available after partner onboarding. The gateway correctly hides the HTML-5xx and returns
`502`. Verifiable live in MTF/Prod with an onboarded partner-id.

## RFI (Request For Information)

All 4 operations are implemented. **`request_id`/`document_id` must be valid RFC-4122 UUIDs**
(`UuidParamPipe`) — an invalid one (e.g. the demo `33000000-0000-0000-0000-000000000000` with
zero version/variant nibbles) is rejected with a **local `400`** before the MC call.

> ⚠️ **Sandbox limit (figured out 2026-06-16).** With a valid UUID the request reaches MC, but MC
> returns **`401 AUTHORIZATION_FAILED`** (code `050007`, “Unauthorized Access”) → the gateway
> masks it as `502`. This is **API-level authorization**: the project / consumer-key is not
> authorized for the RFI API (the same credentials work on balances/quotes/validations). RFI is
> an opt-in API that must be **enabled for the project on the Mastercard Developers portal** (or
> via the MC representative). The gateway code is ready and will work as soon as it’s enabled.

### GET /crossborder/rfi/requests/:requestId
**Purpose.** Retrieve RFI request state. · **Upstream:** `GET /send/partners/{pid}/crossborder/rfi/requests/{requestId}` · **Auth:** tenant · **FLE:** no body. Param `requestId` — `UuidParamPipe` (+ `@ApiParam format:uuid`).

### POST /crossborder/rfi/requests/:requestId
**Purpose.** Send the Customer’s RFI response. · **Upstream:** same path, POST · **Auth:** tenant · **FLE:** yes · **Code:** `200`. Param `requestId` — `UuidParamPipe`. Body — `RfiUpdateRequestDto` (`updateRequest` wrapper, passthrough).

### POST /crossborder/rfi/documents
**Purpose.** Upload a document for an RFI (base64 in JSON, not multipart). · **Upstream:** `POST /send/partners/{pid}/crossborder/rfi/documents` · **Auth:** tenant · **FLE:** yes. Body — `RfiDocumentUploadRequestDto` (`uploadDocumentRequest` wrapper = `{fileName, file}`).

**Special:** this route (POST only) gets a **route-scoped 2 MB body limit** (the global 256 kb is
kept for everything else) — a base64 file up to ~1 MB passes the parser (not 413).

### GET /crossborder/rfi/documents/:documentId
**Purpose.** Download an RFI document. · **Upstream:** `GET /send/partners/{pid}/crossborder/rfi/documents/{documentId}` · **Auth:** tenant · **FLE:** no body. Param `documentId` — `UuidParamPipe`.

---

# Webhooks (inbound from Mastercard)

### POST /webhooks/mastercard
**Purpose.** Receive MC push notifications (transaction/quote statuses, Carded Rate Push, RFI, etc.). · **Upstream:** none (receiver) · **Auth:** `WebhookAuthGuard` · **Code:** **always `200`** (else MC retries). Rate-limit 1200/min (per-pod). Body — `McWebhookEventDto` (passthrough, fields with `@MaxLength` caps).

- **Authentication:** in-service fail-closed token `X-Webhook-Token` (mandatory in prod and dev).
  **The authoritative push authenticity at Mastercard is mTLS, NOT a payload signature** (found in
  the MC docs). MC does not sign push bodies, so there is no in-code signature check — the single
  active factor is the `X-Webhook-Token`. mTLS is configured at the TLS layer.
  > **Verbatim (`api-mastercard.md`):** *“Contact your mastercard representative for mTLS push
  > notification mastercard public certificate. This certificate needs to be trusted by the
  > receiving application. Also, please share the server certificate chain for validation (via
  > KMP portal)…”*
  > **At deployment:** get the public mTLS push cert from the MC representative → into the
  > receiver’s trust store; submit our cert chain via the **KMP portal**. ⚠️ MC **doesn’t know**
  > our `X-Webhook-Token` — it is injected by the TLS layer after mTLS, or a custom header in the
  > portal’s push config (confirm with MC).
- **Dedup** by `eventRef` in **Postgres** (no separate KV layer; MC retries up to 3×):
  repeat → `{"status":"duplicate"}`, else `{"status":"accepted"}`.
- **Persistence in `tx_status`** via one `INSERT … ON CONFLICT (eventRef) DO NOTHING` (dedup AND
  write are **atomic**) — for ALL events: `STATUS_CHG`/`QUOTE_STATUS_CHG` carry status/stage and are
  read by the merchant; others (`CARDFX_PUB`, RFI…) sit there for dedup+audit (filtered out of the
  status read).
- **Notations:** MC sends fields in both camelCase and snake_case — the handler normalizes both.
- **Tenant attribution:** OWN — by `partnerId` (→ its `tenantId`); PLATFORM/unknown → the shared pool (`tenantId=NULL`).
- **Merchant delivery:** polling via `GET /crossborder/status-events?ref=…`.
- **Encrypted push** (`{encrypted_payload:{data}}`): **decrypted by the `kid`** in the cleartext
  JWE header (PLATFORM / per-tenant key); a decrypted event is processed like any other. What
  can't be decrypted (no key for the `kid`, FLE off) is **persisted to `tx_status`
  (`eventType='ENCRYPTED'`) BEFORE the `200`** — otherwise the event would be lost after the ack
  (MC won't retry). Deduped by `enc:sha256(ciphertext)` (or an outer ref if present), reprocessed
  later from the DB. Live confirmation on MTF; sandbox push is “Not Applicable”.

---

# Admin API (platform operator)

Group `/admin/*`. Auth — `X-Admin-Token` (`AdminAuthGuard`). Bodies — **strict** validation
(`gatewayValidationPipe(Strict)`). `secretRef` is never returned (`ClassSerializerInterceptor`). Rate-limit
120/min by IP. No calls to Mastercard.

| Method | Path | What it does | Code |
|---|---|---|---|
| `GET` | `/admin/audit` | Operations log (last 200) | 200 |
| `GET` | `/admin/tenants` | Partner list (`TenantViewDto[]`, no `secretRef`) | 200 |
| `GET` | `/admin/tenants/:id` | One partner (`SafeIdPipe`) | 200 |
| `POST` | `/admin/tenants` | Create a partner (starts in `PENDING`) | 201 |
| `POST` | `/admin/tenants/:id/approve/platform` | Platform approval | 200 |
| `POST` | `/admin/tenants/:id/approve/mastercard` | Mastercard approval | 200 |
| `POST` | `/admin/tenants/:id/suspend` | Suspend (overrides approvals) | 200 |
| `POST` | `/admin/tenants/:id/unsuspend` | Lift suspension | 200 |
| `POST` | `/admin/tenants/:id/clients` | Issue an OAuth client | 201 |
| `DELETE` | `/admin/clients/:clientId` | Revoke a client (404 if absent) | 200 |

A partner becomes `ACTIVE` (transactions allowed) only with **both** approvals and no suspension.

### POST /admin/tenants — body (`CreateTenantDto`, strict validation)
| Field | Rule |
|---|---|
| `name` | string ≤120, required |
| `credentialMode` | `PLATFORM` \| `OWN`, required |
| `id` | string ≤64, `[A-Za-z0-9._-]`, optional (else generated `t_…`) |
| `partnerId` | string ≤64, `[A-Za-z0-9._-]`, optional |
| `secretRef` | string ≤256, no `..`; **required for `OWN`** (`@ValidateIf`) |

### POST /admin/tenants/:id/clients — response
```json
{ "clientId": "mc_RPVCa4sGrL2O", "clientSecret": "<32 chars>",
  "note": "client_secret shown once — save it now" }
```
**`clientSecret` is shown ONCE** (only a hash is stored).

---

# OAuth — issue a merchant token

### POST /oauth/token
**Purpose.** Issue a merchant JWT (this *is* the authentication point). · **Upstream:** none (local JWT) · **Auth:** public, protected by `OAuthThrottlerGuard` (**10/min per `client_id`**, IP fallback) · **Code:** `200` (RFC 6749), headers `Cache-Control: no-store`.

Body (`form-urlencoded` or JSON), `TokenRequestDto` (strict validation), grant `client_credentials`:

| Field | Description |
|---|---|
| `grant_type` | always `client_credentials` (`@IsIn`) |
| `client_id` | issued by the admin API (`mc_…`) |
| `client_secret` | issued by the admin API (shown once) |

`client_id`/`secret` may also come via `Authorization: Basic` (RFC 6749 §2.3.1). Response:
```json
{ "access_token": "<JWT>", "token_type": "Bearer", "expires_in": 900 }
```
JWT lives 15 min (HS256, `tid` = tenantId). Errors: `400 unsupported_grant_type` / `400` (DTO),
`401 invalid_client`.

---

# Service

| Method | Path | What it does |
|---|---|---|
| `GET` | `/health` | **Liveness** (k8s): process alive → `200 {"status":"ok"}`. No auth, no DB. |
| `GET` | `/ready` | **Readiness** (k8s): pings Postgres → `200`/`503`. No auth. |
| `GET` | `/api-docs` | Swagger UI (disabled in production without `SWAGGER_ENABLED`). |

---

# Rate-limit summary

| Group | Limit | Key |
|---|---|---|
| `/crossborder/*` | 120 / min | `tenantId` (fail-closed) |
| `/oauth/token` | 10 / min | `client_id` (not bypassable by IP rotation) |
| `/admin/*` | 120 / min | IP |
| `/webhooks/*` | 1200 / min | per-pod |

Rate-limiting is a self-contained per-pod `@nestjs/throttler` (correctness doesn’t depend on the
ingress); an ingress limit, if any, is optional extra defense. Exceeding → `429`.
