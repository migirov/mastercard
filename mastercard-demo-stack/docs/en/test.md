# Mastercard API coverage — what's live, what's demo, and why

> 🇷🇺 Русская версия: [../ru/test.md](../ru/test.md)

The important distinction: **our gateway (`mastercard`) implements all of these APIs and they
work** — the live validation/balances in the demo go *through* the gateway (with field-level
encryption + OAuth1). What limits the demo is **the Mastercard SANDBOX**, not our code.

There are two reasons something shows up as `demo` instead of `live`:

## 1. The Mastercard sandbox returns different things per API

The sandbox gives real, usable data for some APIs; for others it returns stubs, rejects the
request, or is explicitly unavailable (those need MTF/Prod access). This is Mastercard's
sandbox policy, not a bug on our side:

| API (the gateway supports it) | What the **sandbox** does | Status |
|---|---|---|
| **Account validation** (IBAN) | real `SUCCESS` | 🟢 live |
| **Address validation** | real `VALID` / `VERIFIED` | 🟢 live |
| **Balances** | real account balances | 🟢 live |
| **Bank lookup** | real bank data | 🟢 live (Features → Bank Lookup) |
| **IBAN generation** | real generated IBAN | 🟢 live (Features → IBAN Generator) |
| **Cash pickup** | real location catalogs | 🟢 live (Features → Cash Pickup) |
| **Quote (FX)** | HTTP 200 but a **stub rate (`777`)** | 🟡 structure is real, data is fake → needs MTF/Prod |
| **Payment (submit)** | request reaches MC but is **rejected** (no KYC/onboarding) | 🟡 needs MTF/Prod |
| **Status push** | **"Not Applicable" on sandbox** (per MC docs) | 🔴 MTF/Prod only |
| **Carded Rate** | **"Sandbox unavailable" (per MC docs)** | 🔴 MTF/Prod only |
| **Endpoint Guide** | HTML **502** for the generic partner-id | 🟡 needs an onboarded partner-id |
| **RFI** | requires onboarding (errors `062000` / `401` / `050007`) | 🟡 needs MTF/Prod |

So "the other APIs don't work" is **not** the case — they work in the gateway, but the
**Mastercard sandbox** returns fake data or rejects payments/status/quotes until the partner is
onboarded. **Getting MTF/Prod access is exactly what the email to Mastercard requests.** Once
granted, it's an env flip (`demo → live`) — no code change.

## 2. Features pages — the rest of the gateway APIs, now surfaced in the UI

The invoice frontend's screens map to **quote / validation / balances / pay / status**. Every
*other* cross-border API the gateway implements is now exposed under a **Features** group in the
sidebar — each as a standalone tool with a **Live · Mastercard** / **Demo** badge per response
(driven by the BFF `source` field):

| Features page | Gateway API | Sandbox today |
|---|---|---|
| **Bank Lookup** | `POST /crossborder/bank-lookups` | 🟢 live — real banks / BIC / branch |
| **IBAN Generator** | `POST /crossborder/iban-generations` | 🟢 live — real generated IBAN + bank |
| **Cash Pickup** | `GET /crossborder/cash-pickup/{countries,cities,providers,branches}` | 🟢 live — real catalogs |
| **FX Rates** | `GET /crossborder/rates` | 🟡 demo — sandbox returns no carded-rate data |
| **Endpoint Guide** | `GET /crossborder/endpoint-guide/specifications` | 🟡 demo — sandbox 502 (needs onboarded partner-id) |
| **Quote Lifecycle** | `POST /quotes/confirmations·cancellations`, `GET …/proposals/:id` | 🟡 demo — needs a confirmed-quote flow |
| **Payment Tracker** | `GET /payments?ref`, `POST /payments/:id/cancel`, `status-events` | 🟡 demo — above sandbox |
| **RFI Center** | `GET/POST /crossborder/rfi/requests`, `POST /rfi/documents` | 🟡 demo — RFI not enabled for the project |

The **3 live pages return REAL Mastercard sandbox data** through the gateway (FLE + OAuth1); the
**5 demo pages** synthesize believable responses and flip to live via env — exactly like
pay/status — once Mastercard opens them. Each capability is switched independently (toggles
below). Live calls fall back to demo automatically if the sandbox rejects the request, so the
demo never breaks on stage.

## 3. Features API — request examples (the endpoints we added)

The Features pages call the demo BFF under `/features/*`. You can hit them directly on the BFF
port (`:4011`, mastercard-bff) or through the frontend proxy (`http://localhost:8080/demo-api/features/*`).
**Every response carries a `source` field** (`live` / `demo`). The wiring is summarized at
`GET http://localhost:4011/health` (the `features` block).

```bash
curl -s http://localhost:4011/health        # → "features":{"bankLookup":"live", ... ,"rfi":"demo"}
```

### 🟢 Bank Lookup — `POST /features/bank-lookup` (live)
```bash
curl -s -X POST http://localhost:4011/features/bank-lookup \
  -H 'Content-Type: application/json' \
  -d '{"name":"*of Africa United Kingdom*SUC20004","country":"GBR"}'
# → {"banks":[{"name":"...","bic":"428773","branch":"East Bay Branch","country":"GBR",...}],
#    "total":4,"source":"live"}
```
Body: `name` (MC accepts `*` wildcards), `country` (ISO-3), `bic?` (optional).

### 🟢 IBAN Generator — `POST /features/iban` (live)
```bash
curl -s -X POST http://localhost:4011/features/iban \
  -H 'Content-Type: application/json' \
  -d '{"country":"FRA","ban":"20041010050500013M02606","branchCode":"2004101005","accountNo":"0500013026"}'
# → {"iban":"FR1420041010050500013M02606","ban":"20041010050500013M02606",
#    "bank":{"bic":"PSSTFRPPLIL","name":"La Banque Postale","branchCode":"2004101005","address":"Lille, FRA"},
#    "source":"live"}
```
Body: `country` (ISO-3, required), `ban?`, `branchCode?`, `accountNo?`.

### 🟢 Cash Pickup — `GET /features/cash-pickup/{kind}` (live)
```bash
curl -s "http://localhost:4011/features/cash-pickup/countries?cash_pickup_type=PANY"
# → {"items":[{"countryAlpha3":"NGA","currency":"NGN","cashPickupType":"PANY"}, ...],"source":"live"}

curl -s "http://localhost:4011/features/cash-pickup/cities?country=GTM&currency=GTQ&limit=5"
# → {"items":[{"country":"GTM","currency":"GTQ","city":"...","stateName":"..."}],"total":361,"source":"live"}

curl -s "http://localhost:4011/features/cash-pickup/providers?country=ARE&currency=AED&cash_pickup_type=IN_NETWORK&limit=5"
# → {"items":[{"providerId":"...","providerName":"ORIENT EXCHANGE","country":"ARE","currency":"AED"}],"source":"live"}

# branches need a provider_id (take one from the providers result above):
curl -s "http://localhost:4011/features/cash-pickup/branches?provider_id=<providerId>&limit=5"
```
Query (all optional): countries → `cash_pickup_type`; cities → `country,currency,offset,limit`;
providers → `+cash_pickup_type`; branches → `provider_id,state,city,offset,limit`.

### 🟡 FX Rates — `GET /features/rates` (demo)
```bash
curl -s "http://localhost:4011/features/rates"
# → {"rates":[{"pair":"USD/ILS","rate":3.7,"change":0.01}, ...],"asOf":"...","source":"demo"}
curl -s "http://localhost:4011/features/rates?base=USD&quote=ILS"   # single pair
```
Demo because the MC sandbox returns no carded-rate data (`{"rates":{}}`).

### 🟡 Endpoint Guide — `GET /features/endpoint-guide` (demo)
```bash
curl -s "http://localhost:4011/features/endpoint-guide?payment_type=B2B&destination_country=PHL&destination_currency=PHP&destination_payment_instrument=BANK"
# → {"corridor":{...},"fields":[{"name":"recipient_account_uri","required":true,"description":"..."}, ...],
#    "limits":{"min":"1.00","max":"50000.00","currency":"PHP"},"source":"demo"}
```
Demo because the sandbox returns an HTML 502 for the generic partner-id.

### 🟡 Quote Lifecycle — `/features/quote-lifecycle/*` (demo)
```bash
curl -s -X POST http://localhost:4011/features/quote-lifecycle/confirm \
  -H 'Content-Type: application/json' \
  -d '{"transactionReference":"08POC342598033X","proposalId":"pen-4000000044472562338287758"}'
# → {"transactionReference":"...","proposalId":"...","state":"CONFIRMED","expiresAt":"...","source":"demo"}

curl -s -X POST http://localhost:4011/features/quote-lifecycle/cancel \
  -H 'Content-Type: application/json' \
  -d '{"transactionReference":"08POC342598033X","proposalId":"pen-4000000044472562338287758"}'
# → {"...","state":"CANCELLED","source":"demo"}

curl -s "http://localhost:4011/features/quote-lifecycle/retrieve?transactionReference=08POC342598033X&proposalId=pen-4000000044472562338287758"
# → {"...","state":"CONFIRMED","fxRate":3.7,"chargedAmount":"110.41","currency":"USD","source":"demo"}
```

### 🟡 Payment Tracker — `/features/payment-tracker` (demo)
```bash
curl -s "http://localhost:4011/features/payment-tracker?ref=XBSDEMO12345"
# → {"ref":"XBSDEMO12345","status":"processing","stage":"screening",
#    "history":[{"status":"pending","stage":"received","timestamp":"..."}, ...],"source":"demo"}
# (repeat after a minute — the stage advances over wall-clock time)

curl -s -X POST http://localhost:4011/features/payment-tracker/cancel \
  -H 'Content-Type: application/json' -d '{"id":"PMT-123"}'
# → {"id":"PMT-123","state":"CANCELLED","source":"demo"}
```

### 🟡 RFI Center — `/features/rfi/*` (demo)
```bash
curl -s "http://localhost:4011/features/rfi/requests/33000000-0000-4000-8000-000000000000"
# → {"requestId":"...","status":"PENDING","questions":[{"code":"SENDER_ID","label":"...","required":true}, ...],"source":"demo"}

curl -s -X POST http://localhost:4011/features/rfi/requests/33000000-0000-4000-8000-000000000000 \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"John","lastName":"Doe","message":"Documents attached"}'
# → {"requestId":"...","state":"SUBMITTED","source":"demo"}

curl -s -X POST http://localhost:4011/features/rfi/documents \
  -H 'Content-Type: application/json' \
  -d '{"fileName":"proof.pdf","file":"dGVzdA=="}'   # file = base64, no data: prefix
# → {"documentId":"...","fileName":"proof.pdf","state":"UPLOADED","source":"demo"}
```

## Proof it's a real Mastercard call

When you click **Validate** in the UI (or run a live Features call), the gateway log shows the
real sandbox round-trip:

```
POST /crossborder/account-validations  → 200  (1500ms)   tenant=platform
POST /crossborder/bank-lookups         → 200  (1400ms)   tenant=platform
```

The ~1.3–1.5s latency + the FLE encryption round-trip (request encrypted with the Client key,
response decrypted with our Mastercard key) confirm it reached Mastercard, not a local stub.
See it yourself:

```bash
cd mastercard-demo-stack
docker compose logs app | grep -E 'account-validations|bank-lookups|cash-pickup'
curl http://localhost:4011/xbs/balances     # real sandbox accounts, "source":"live"
```

## Flip to live when MTF/Prod is enabled

When Mastercard enables MTF/Prod, change `mastercard-demo-stack/.env` and recreate the BFF —
no code change (the working request bodies are already in place):

```ini
XBS_QUOTE_MODE=live
XBS_PAYMENT_MODE=live
XBS_STATUS_MODE=live
# Features pages (bank-lookup / IBAN / cash-pickup are already live by default):
XBS_RATES_MODE=live
XBS_ENDPOINT_GUIDE_MODE=live
XBS_QUOTE_LIFECYCLE_MODE=live
XBS_PAYMENT_TRACKER_MODE=live
XBS_RFI_MODE=live
```
```bash
docker compose up -d mastercard-bff
```

## Summary

- ❌ Not a gateway problem — the gateway implements everything and is tested.
- 🟢 Real on sandbox today: **account validation, address validation, balances, bank lookup,
  IBAN generation, cash pickup**.
- 🟡 Payments / quotes / status / rates / endpoint-guide / RFI — sandbox returns stubs or rejects
  → **waiting on MTF/Prod from Mastercard** (the email). Code is ready; toggled via `.env`.
- Every other cross-border API the gateway implements is now surfaced under the **Features**
  sidebar group (8 pages): Bank Lookup / IBAN Generator / Cash Pickup are **live** (real sandbox
  data); FX Rates / Endpoint Guide / Quote Lifecycle / Payment Tracker / RFI Center are **demo**
  until MTF/Prod, env-switchable.
