# XBS Embedded — Demo stack

A self-contained demo that drives the **real Mastercard Cross-Border gateway** (`mastercard`)
from a web UI, with everything the sandbox cannot do yet served by a throwaway demo backend.

> 🇷🇺 Русская версия: [README.ru.md](README.ru.md)

---

## 1. What's in the stack (5 containers)

The BFF is split into two services by responsibility — the **permanent app backend** and the
**Mastercard cross-border layer** (the part that's replaced/slimmed once MTF/Prod is granted).
nginx serves one origin (`/demo-api`) and splits the path between them:

```
 browser ─► frontend (nginx, :8080) ─► /demo-api ─┬─ /xbs/* + /features/* ─► mastercard-bff (:4011) ─► mastercard gateway (app, :3000) ─► Mastercard SANDBOX
                                                   │
                                                   └─ everything else ──────► app-bff (:4010) ─► mc_demo (entity store / auth / integrations)

        postgres (shared) ◄── mc_demo (app-bff)   +   mc_gateway (gateway)
```

| Service | Folder | Role |
|---|---|---|
| `frontend` | `../masrtercard-front` | The web UI (React/Vite, nginx). Talks only to `/demo-api`; nginx routes the path to the two BFFs. |
| `app-bff` | `../app-bff` | **Permanent app backend.** Schema-less entity store + `auth.me` + integrations over Postgres. NO Mastercard — stays to support the frontend. |
| `mastercard-bff` | `../mastercard-bff` | **Cross-border layer (stateless).** The `/xbs` + `/features` API: proxies the gateway (live) or synthesizes (demo), per capability. The Mastercard-facing part. |
| `app` | `../mastercard` | **Our real product.** The Mastercard Cross-Border gateway. Calls the real Mastercard sandbox. |
| `postgres` | — | One Postgres server, two databases: `mc_demo` (app-bff) + `mc_gateway` (gateway). |

---

## 2. Run & access

```bash
cd mastercard-demo-stack
docker compose up -d --build      # first run builds all images
docker compose ps                 # all 5 should be running/healthy
```

- **Web UI:** http://localhost:8080 — password **`0544326303`**
- app-bff (direct API, for devs): http://localhost:4010/health
- mastercard-bff (direct API, live/demo wiring): http://localhost:4011/health

Stop: `docker compose down` (keep data) or `docker compose down -v` (wipe data + re-seed on next up).

---

## 3. How to test (step by step)

1. Open **http://localhost:8080**, enter password **`0544326303`**.
2. **Dashboard "Accounts Payable"** — a list of seeded invoices (INV-1001…1006).
3. **See a REAL Mastercard call** 👇
   - Tick **INV-1006 (Cedar Cloud Services, $5,600)** → click **"Pay now"** (top-right).
   - In the **Review** step, INV-1006 already has Mastercard's *documented sandbox* IBAN
     (`FR07…`) and address.
   - Click **"Validate"** next to the IBAN and next to the Address → the **Validated** badge
     appears. **This is a real call to the Mastercard sandbox** through our gateway
     (account/address validation returns a real `SUCCESS`/`VERIFIED`).
4. **FX quote** — change "Payment Currency" (e.g. to ILS/EUR). The **FX Quote** panel shows a
   rate with an **"Indicative · Demo"** badge (demo rate — see §5 why).
5. **Funding + Submit + status** —
   - At the **Funding** step, below "Sufficient account balance" a **Mastercard account balance**
     panel shows your real account holdings from **`/xbs/balances`** (a real MC sandbox call,
     tagged **Live · Mastercard**). Sufficiency itself is checked against the demo company
     balance, so the flow stays predictable.
   - **Submit** → the invoice walks pending → processing → completed.
   - Click an invoice's **status** to open the drill-down → the **Payment** tab shows a
     **"Processing timeline · via Mastercard gateway"** (received → screening → in-network →
     settled) fetched from **`/xbs/status`**, tagged with a live/demo badge.
6. **Other pages** (left sidebar): Cards, Invoices & Employees, Tests, Integration Docs — all
   served by the demo backend.
7. **Features** (left sidebar, bottom group) — standalone tools for the *rest* of the
   Mastercard cross-border APIs. The ones with a green dot return **real sandbox data**: open
   **Bank Lookup** and click *Search* → real banks/BICs; **IBAN Generator** → a real generated
   IBAN; **Cash Pickup** → real country/city/provider catalogs. The others (FX Rates, Endpoint
   Guide, Quote Lifecycle, Payment Tracker, RFI Center) are demo until MTF/Prod (see §6).

> Tip: every cross-border response carries a `source` field — `"live"` (real Mastercard) or
> `"demo"`. The UI shows it as a badge; you can also see the live/demo wiring at
> http://localhost:4011/health (mastercard-bff) and on the `/xbs/*` + `/features/*` endpoints.

---

## 4. Where each page's data comes from

**Rule of thumb:** all the *screens and records* are the **demo** part; the only thing that
reaches our `mastercard` service (and the real Mastercard sandbox) is the **cross-border
payment operations** — and of those, only the sandbox-supported ones are live today.

| Page (route) | What you see | Comes from |
|---|---|---|
| `/` **Dashboard** (Accounts Payable) | invoice list, balances, KYB banner | `app-bff` (seeded demo data) |
| `/` → Pay → **Review → "Validate" IBAN/Address** | beneficiary validation | 🟢 **mastercard-bff → `mastercard` gateway → MC sandbox (LIVE)** |
| `/` → Pay → **Review → FX Quote** | indicative rate | `mastercard-bff` (demo — see §5) |
| `/` → Pay → **Funding** | real account balance | 🟢 **mastercard-bff `/xbs/balances` → MC sandbox (LIVE)** |
| `/` → Pay → **submit** | payment submit | `mastercard-bff` (demo — see §5) |
| `/` → Pay → **status drill-down** | processing timeline | `mastercard-bff` `/xbs/status` (demo — see §5) |
| `/cards` **Card Management** | virtual cards, employees, card transactions | `app-bff` (not a cross-border product) |
| `/invoices-employees` | invoices + employees | `app-bff` |
| `/dashboard3` | onboarding-variant dashboard | `app-bff` |
| **Features** pages (`/features/*`) | bank lookup / IBAN / cash pickup / … | `mastercard-bff` (live or demo per page — see §6) |
| `/test` **Test Suite** | internal test page | `app-bff` |
| `/integration-docs` | static spec page | static (no backend) |

All UI entities — `Invoice`, `CompanyProfile`, `VirtualCard`, `CardTransaction`, `Employee`,
`TopUp`, `PaymentApproval`, `AppUser` — live in `app-bff`'s `mc_demo` database (seeded on
boot). Editing/creating them in the UI persists to `app-bff`, **not** to Mastercard.

---

## 5. Live vs Demo — the cross-border operations

`mastercard-bff` proxies cross-border operations to the gateway **per capability**. The split
matches what the Mastercard *sandbox* actually supports:

| Operation (`/xbs/*`) | Mode | Why |
|---|---|---|
| `validate-account` (IBAN) | 🟢 **live** | Sandbox returns a real `SUCCESS` for the documented test IBAN |
| `validate-address` | 🟢 **live** | Sandbox returns a real `VALID`/`VERIFIED` for the documented test address |
| `balances` | 🟢 **live** | Sandbox returns real account balances |
| `quote` (FX) | 🟡 **demo** | Sandbox returns a *dummy* rate (`777`), unusable for display → realistic demo rate instead |
| `pay` (submit) | 🟡 **demo** | Payment submission needs MTF/Prod access (not on sandbox) |
| `status` (tracking) | 🟡 **demo** | Status push needs MTF/Prod access (not on sandbox) |

The UI surfaces these directly: the **Funding** step shows the live `/xbs/balances`, and the
invoice **status drill-down** shows the `/xbs/status` processing timeline (both tagged with the
live/demo badge). When MTF/Prod is enabled, `status` flips to `live` with no UI change.

> 📄 Full per-API breakdown — what the sandbox supports for **every** Mastercard API, plus
> request examples for the Features endpoints — is in **[docs/en/test.md](docs/en/test.md)**
> (🇷🇺 [docs/ru/test.md](docs/ru/test.md)).

**These are env switches — no code change.** When Mastercard enables MTF/Prod, flip a value in
`mastercard-demo-stack/.env` and recreate the container:

```ini
XBS_QUOTE_MODE=demo        # demo | live — sandbox rate is a stub (777); → live on MTF/Prod
XBS_VALIDATION_MODE=live
XBS_BALANCES_MODE=live
XBS_PAYMENT_MODE=demo      # → live once MTF/Prod is enabled
XBS_STATUS_MODE=demo       # → live once MTF/Prod is enabled
```
```bash
docker compose up -d mastercard-bff   # apply the new modes (cross-border lives here)
```

If a `live` call fails (e.g. an unsupported sandbox input), the BFF **gracefully falls back**
to a demo response and marks `source: "demo"` — the UI never breaks.

---

## 6. Features — the rest of the Mastercard APIs (sidebar "Features" group)

The invoice flow only uses quote/validation/balances/pay/status. Every *other* cross-border
API the gateway implements is exposed as a standalone **Features** page (`/features/*` →
mastercard-bff → gateway). Each shows a **Live · Mastercard** / **Demo** badge per response; the
three live ones return **real Mastercard sandbox data** today.

| Features page (route) | Gateway API | Mode today |
|---|---|---|
| **Bank Lookup** (`/features/bank-lookup`) | `POST /crossborder/bank-lookups` | 🟢 **live** |
| **IBAN Generator** (`/features/iban`) | `POST /crossborder/iban-generations` | 🟢 **live** |
| **Cash Pickup** (`/features/cash-pickup`) | `GET /crossborder/cash-pickup/{countries,cities,providers,branches}` | 🟢 **live** |
| **FX Rates** (`/features/rates`) | `GET /crossborder/rates` | 🟡 demo (sandbox has no carded-rate data) |
| **Endpoint Guide** (`/features/endpoint-guide`) | `GET /crossborder/endpoint-guide/specifications` | 🟡 demo (sandbox 502) |
| **Quote Lifecycle** (`/features/quote-lifecycle`) | confirm / cancel / retrieve a proposal | 🟡 demo |
| **Payment Tracker** (`/features/payment-tracker`) | lookup / cancel / status-events | 🟡 demo |
| **RFI Center** (`/features/rfi`) | RFI requests + documents | 🟡 demo (RFI not enabled for the project) |

Each is switched independently in `.env` (defaults shown): `XBS_BANK_LOOKUP_MODE`, `XBS_IBAN_MODE`,
`XBS_CASH_PICKUP_MODE` = `live`; `XBS_RATES_MODE`, `XBS_ENDPOINT_GUIDE_MODE`,
`XBS_QUOTE_LIFECYCLE_MODE`, `XBS_PAYMENT_TRACKER_MODE`, `XBS_RFI_MODE` = `demo` → flip to `live`
when Mastercard opens them. Verify the wiring at http://localhost:4011/health (`features` block).

---

## 7. Useful commands

```bash
docker compose ps                          # status
docker compose logs -f mastercard-bff      # cross-border BFF logs (shows live/fallback)
docker compose logs -f app-bff             # app BFF logs (entity store / seed)
docker compose logs -f app                 # gateway logs (shows the real MC calls)
curl http://localhost:4011/health          # the live|demo wiring (mastercard-bff)
curl http://localhost:4010/entities/Invoice   # seeded entities (app-bff)
docker compose up -d --build               # rebuild after code changes
docker compose down -v                     # reset everything (re-seeds on next up)
```

The gateway's own sandbox credentials/certs are provided at runtime from `../mastercard/.env`
and `../mastercard/certs` (mounted read-only — never baked into any image).
