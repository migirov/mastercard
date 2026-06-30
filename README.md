# XBS Embedded — Mastercard Cross-Border monorepo

🇬🇧 English · [🇷🇺 Русский](README.ru.md)

A monorepo for the Mastercard Cross-Border demo: the **real multi-tenant gateway** to Mastercard
Cross-Border Services, plus the backend and web UI that drive it. The web UI runs the full
invoice-payment flow and exercises every cross-border API — calling the **real Mastercard
sandbox** where it's available, and synthesizing a realistic **demo** response where the sandbox
can't yet (each is an env switch, no code change).

---

## Components

| Folder | What it is | Port | State |
|---|---|---|---|
| [`mastercard/`](mastercard/) | **The product.** Multi-tenant NestJS gateway to Mastercard Cross-Border Services (OAuth1-signed per tenant, JWE field-level encryption, dual-approval). Designed to embed into the client monolith. | `3000` | Postgres `mc_gateway` |
| [`mastercard-bff/`](mastercard-bff/) | **Cross-border layer (stateless).** The `/xbs` + `/features` API — proxies the gateway (`live`) or synthesizes (`demo`) per capability, with graceful fallback. The Mastercard-facing BFF. | `4011` | none |
| [`app-bff/`](app-bff/) | **Permanent app backend.** Schema-less entity store + `auth.me` + integrations. Holds all UI data (invoices, cards, employees…). No Mastercard. | `4010` | Postgres `mc_demo` |
| [`masrtercard-front/`](masrtercard-front/) | **Web UI** (React / Vite, served by nginx). Talks only to `/demo-api`; nginx splits the path between the two BFFs. | `8080` | none |
| [`mastercard-demo-stack/`](mastercard-demo-stack/) | **Docker Compose** that ties the five containers together (incl. shared Postgres), plus the step-by-step test guide. | — | — |

```
 browser ─► frontend (nginx, :8080) ─► /demo-api ─┬─ /xbs/* + /features/* ─► mastercard-bff (:4011) ─► mastercard gateway (:3000) ─► Mastercard SANDBOX
                                                   │
                                                   └─ everything else ──────► app-bff (:4010) ─► mc_demo (entity store / auth / integrations)

        postgres (shared) ◄── mc_demo (app-bff)   +   mc_gateway (gateway)
```

---

## Quick start

The whole stack runs from the compose folder:

```bash
cd mastercard-demo-stack
cp .env.example .env          # fill in GATEWAY_INTERNAL_TOKEN (must match mastercard/.env)
docker compose up -d --build  # first run builds all 5 images
docker compose ps             # all 5 should be running/healthy
```

- **Web UI:** http://localhost:8080 — password **`0544326303`**
- app-bff health: http://localhost:4010/health · mastercard-bff health (live/demo wiring): http://localhost:4011/health

Full run/test walkthrough, page-by-page data sources, and the live-vs-demo matrix are in
**[mastercard-demo-stack/README.md](mastercard-demo-stack/README.md)** and its
[`docs/en`](mastercard-demo-stack/docs/en/) · [`docs/ru`](mastercard-demo-stack/docs/ru/) guides.

---

## Live vs demo

`mastercard-bff` proxies each cross-border capability to the gateway **independently**. Today the
sandbox supports account/address **validation**, **balances**, **bank lookup**, **IBAN
generation** and **cash-pickup** catalogs (🟢 live); FX **quote**, **pay**, **status** and the
remaining feature tools are 🟡 demo until MTF/Prod is enabled. Every cross-border response carries
a `source: "live" | "demo"` field, shown in the UI as a badge. Switch any capability via the
`XBS_*_MODE` vars in `mastercard-demo-stack/.env` — no code change. See the demo-stack README §5–6.

---

## Repository layout

```
mastercard-app/
├─ mastercard/            the gateway (the product)         → :3000, db mc_gateway
├─ mastercard-bff/        cross-border BFF (/xbs,/features)  → :4011, stateless
├─ app-bff/              app data BFF (entities/auth)       → :4010, db mc_demo
├─ masrtercard-front/     web UI (React/Vite + nginx)        → :8080
├─ mastercard-demo-stack/ docker compose + test docs
└─ .gitignore             root safety net for secrets
```

Each component has its own README with standalone run / test / config details.

---

## Secrets

Secrets are **never** committed. The root [`.gitignore`](.gitignore) ignores every `**/.env`,
`**/certs/`, `**/*.p12`, `**/*.pem`, `**/*.key` across all components (keeping `**/.env.example`
templates). Real values live only locally:

- `mastercard/.env` + `mastercard/certs/*` — sandbox credentials & crypto material (mounted into
  the gateway container read-only at runtime, never baked into an image).
- `mastercard-demo-stack/.env` — the shared internal token + live/demo switches.

Copy the `.env.example` next to each, fill in the values, and you're set.
