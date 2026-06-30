# XBS Embedded — Frontend

React + Vite single-page app for the XBS cross-border payments demo.

## Development

```
npm install
npm run dev
```

The app talks to the demo backend (BFF) under `/demo-api`. Configure the base URL with
`VITE_DEMO_API_URL` (defaults to `http://localhost:4000` for local dev; in the container build
it is `/demo-api`, reverse-proxied by nginx to the BFF).

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
