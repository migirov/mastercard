# app-bff

The **permanent app backend** for the XBS frontend (one of the two BFFs the old
`mastercard-demo-api` was split into; the cross-border half is now `../mastercard-bff`).

**One job — the app data layer.** A schema-less entity store: a generic jsonb `records`
table behind `GET/POST/PUT/PATCH/DELETE /entities/:name`, plus `/auth/me` and
`/integrations/*` (LLM + file upload, stubbed). All UI data (invoices, cards, employees, …)
lives here, seeded on boot. **It has NOTHING to do with Mastercard** — cross-border (`/xbs`,
`/features`) is served by `mastercard-bff`. In the stack, nginx routes everything under
`/demo-api` here EXCEPT `/demo-api/xbs/*` and `/demo-api/features/*`.

It mirrors the sibling gateway's conventions: Zod-validated env, a typed `DemoConfig` (no
scattered `process.env`), migrations-only TypeORM (`synchronize: false`, `autoLoadEntities`),
module-by-responsibility.

## Run

Normally run as part of the stack — see `../mastercard-demo-stack/docker-compose.yml`
(`docker compose up -d --build`; this service is `app-bff`, host port `4010`). Standalone:

```bash
npm install
npm run build && npm run start:prod      # needs Postgres reachable (see env below)
```

`main.ts` creates the `mc_demo` database if absent, then TypeORM runs migrations on boot.

## Test / lint

```bash
npm test          # jest unit specs
npm run lint      # eslint (+ prettier)
```

## Configuration (all optional — defaults target the compose stack)

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `DEMO_DB_HOST/PORT/USER/PASSWORD/NAME` | `postgres/5432/mc/mc/mc_demo` | App data DB (its OWN db; never the gateway's `mc_gateway`) |
| `NODE_ENV` | `development` | non-prod runs migrations on boot |

No Mastercard/gateway configuration here — see `../mastercard-bff` for that. The full
live-vs-demo breakdown is in `../mastercard-demo-stack/docs/en/test.md`.
