# XBS Embedded — Frontend

React + Vite single-page app for the XBS cross-border payments demo.

## Development

```
npm install
npm run dev
```

The app talks to the demo backend (BFF) under `/demo-api`. Configure the base URL with
`VITE_DEMO_API_URL` (defaults to `http://localhost:4000` for local dev).

Both BFFs require a shared bearer token, so `npm run dev` also needs **`VITE_DEMO_API_TOKEN`**
set to the same value as `DEMO_API_TOKEN` in `mastercard-demo-stack/.env` — copy
[.env.example](.env.example) to `.env` and fill it in, otherwise every API call returns 401.

**In a container these two variables are not used.** The image reads its configuration at
container START — `docker-entrypoint.sh` writes `window.__XBS_CONFIG__` into `/config.js` (which
`index.html` loads ahead of the bundle) and fills the nginx upstreams from the environment:

| Variable | Default | Purpose |
|---|---|---|
| `DEMO_API_TOKEN` | none | shared bearer token; unset ⇒ every API call 401s |
| `DEMO_API_URL` | `/demo-api` | base path the SPA calls |
| `APP_BFF_URL` | `app-bff:4000` | nginx upstream for everything except `/xbs` + `/features` |
| `MASTERCARD_BFF_URL` | `mastercard-bff:4000` | nginx upstream for `/xbs` + `/features` |

That is why the published image is deployable anywhere and carries no token: rotating one is a
container restart, not a rebuild. The `VITE_*` variables survive only as the `npm run dev`
fallback in [src/api/demoApi.js](src/api/demoApi.js).

## Build

```
npm run build      # outputs to dist/
npm run preview    # serve the production build locally
```

## Structure

- `src/api/` — the data client (`apiClient.js` = entity CRUD / auth / integrations) and the
  cross-border operations (`xbs.js`: quote / validation / balances / pay / status).
- `src/pages/`, `src/components/` — the UI (dashboard, payment flow, cards, settings).
- `src/lib/` — auth context, helpers.

The full stack (frontend + BFF + gateway + Postgres) is orchestrated from
`../mastercard-demo-stack/docker-compose.yml`.
