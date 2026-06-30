# mastercard-bff

The **Mastercard cross-border layer** for the XBS frontend (one of the two BFFs the old
`mastercard-demo-api` was split into; the app data half is now `../app-bff`).

**One job — proxy/synthesize the cross-border APIs. STATELESS (no database).** Two surfaces:

1. **`/xbs/*`** — the core payment flow: quote / validate-account / validate-address /
   balances / pay / status.
2. **`/features/*`** — the standalone Mastercard tools: bank-lookup, iban, cash-pickup, rates,
   endpoint-guide, quote-lifecycle, payment-tracker, rfi.

Each capability is independently `live` (proxied to the sibling Mastercard gateway → MC
sandbox) or `demo` (synthesized), with **graceful fallback** to demo on any gateway error.
Every response carries a `source: 'live' | 'demo'` field. In the stack, nginx routes
`/demo-api/xbs/*` and `/demo-api/features/*` here.

It mirrors the sibling gateway's conventions: Zod-validated env, a typed `DemoConfig` (no
scattered `process.env`), module-by-responsibility, per-route validation DTOs, and body
parsing as Nest middleware (`AppModule.configure`, RFI route gets a larger limit — gateway
issue #11). No TypeORM/Postgres — this service holds no state.

## Run

Normally run as part of the stack — see `../mastercard-demo-stack/docker-compose.yml`
(`docker compose up -d --build`; this service is `mastercard-bff`, host port `4011`).
Standalone:

```bash
npm install
npm run build && npm run start:prod      # needs the gateway reachable (GATEWAY_URL) for live mode
```

## Test / lint

```bash
npm test          # jest unit specs
npm run lint      # eslint (+ prettier)
```

## Configuration (all optional — defaults target the compose stack)

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `GATEWAY_URL` | `http://app:3000` | The Mastercard gateway |
| `GATEWAY_INTERNAL_TOKEN` | — | Internal service-to-service token for the gateway |
| `GATEWAY_TENANT_ID` | `platform` | Gateway tenant for live calls (the gateway's seeded baseline) |
| `XBS_QUOTE_MODE` / `XBS_VALIDATION_MODE` / `XBS_BALANCES_MODE` | `live` | `live` \| `demo` |
| `XBS_PAYMENT_MODE` / `XBS_STATUS_MODE` | `demo` | `live` \| `demo` (need MTF/Prod) |
| `XBS_BANK_LOOKUP_MODE` / `XBS_IBAN_MODE` / `XBS_CASH_PICKUP_MODE` | `live` | Feature pages — real sandbox data |
| `XBS_RATES_MODE` / `XBS_ENDPOINT_GUIDE_MODE` / `XBS_QUOTE_LIFECYCLE_MODE` / `XBS_PAYMENT_TRACKER_MODE` / `XBS_RFI_MODE` | `demo` | Feature pages — sandbox-limited |

No DB configuration here — see `../app-bff` for that. The full live-vs-demo breakdown is in
`../mastercard-demo-stack/docs/en/test.md`.
