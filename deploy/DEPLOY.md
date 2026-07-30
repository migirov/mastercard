# Deployment guide — XBS Embedded

🇬🇧 English · [🇷🇺 Русский](DEPLOY.ru.md)

Everything needed to run the stack from published images. No repository access required.

---

## 1. Images

Four application images, all built from one commit and released under one tag.

| Image | Role | Port | Data |
|---|---|---|---|
| `ghcr.io/migirov/mastercard/gateway:<tag>` | Mastercard Cross-Border gateway. The only service that talks to Mastercard. | `3000` | Postgres `mc_gateway` |
| `ghcr.io/migirov/mastercard/mastercard-bff:<tag>` | Cross-border API (`/xbs`, `/features`). Stateless. | `4000` | none |
| `ghcr.io/migirov/mastercard/app-bff:<tag>` | App backend — entity store, auth, integrations. | `4000` | Postgres `mc_demo` |
| `ghcr.io/migirov/mastercard/frontend:<tag>` | Web UI (nginx) + reverse proxy for `/demo-api`. | `80` | none |

Postgres is **not** one of our images — use `postgres:16-alpine` or a managed instance.

Platform: `linux/amd64`. Each image carries `org.opencontainers.image.revision` with the source
commit, and a `HEALTHCHECK`.

### Pull

```bash
docker login ghcr.io -u <username>       # password = a GitHub token with read:packages
docker pull ghcr.io/migirov/mastercard/gateway:<tag>
docker pull ghcr.io/migirov/mastercard/mastercard-bff:<tag>
docker pull ghcr.io/migirov/mastercard/app-bff:<tag>
docker pull ghcr.io/migirov/mastercard/frontend:<tag>
```

The packages are private; credentials are supplied separately.

---

## 2. Topology

```
 browser ─► frontend (nginx, :80) ─► /demo-api ─┬─ /xbs/* + /features/* ─► mastercard-bff (:4000) ─► gateway (:3000) ─► Mastercard
                                                 │
                                                 └─ everything else ──────► app-bff (:4000)

        postgres ◄── mc_demo (app-bff)   +   mc_gateway (gateway)
```

Only `frontend` needs to be reachable from outside. Put TLS termination in front of it (ALB,
nginx, Cloudflare); the container listens on plain HTTP.

The gateway needs **outbound HTTPS to Mastercard**. It needs an inbound path only if Mastercard
push notifications (webhooks) are enabled — see §6.

---

## 3. Configuration model

**No image contains a secret.** Everything is supplied at container start:

- **Environment variables** — the full list is in [`.env.example`](.env.example), grouped and
  annotated (`SECRET` / `REQUIRED` / defaults). That file is the reference; this guide covers
  what it cannot say on its own.
- **Files** — the Mastercard key material, mounted read-only. It is delivered out of band and
  must never be committed, imaged, or pushed to a registry.

Three services share **one** `DEMO_API_TOKEN` (frontend, app-bff, mastercard-bff), and two share
**one** internal token (`GATEWAY_INTERNAL_TOKEN` on the BFF = `MC_INTERNAL_TOKEN` on the
gateway). If either pair drifts, calls fail with 401 or silently fall back to demo data.

`DEMO_GATE_PASSWORD` is different in kind: **one** service gets it (app-bff), and it never leaves
the backend. It is the password typed into the UI's access gate, verified server-side by
`POST /demo-api/gate/verify`. Do not set it on `frontend` or `mastercard-bff` — the point is that
the browser never receives it. Note that `DEMO_API_TOKEN`, by contrast, *is* served to the browser
in `/config.js` by design, so it is a barrier against unauthenticated API access rather than a
secret.

Rotating either is a restart, not a rebuild: the frontend image reads its configuration at
container start and writes it into the page it serves, and app-bff reads the gate password from its
environment on boot.

### Not deploying with Compose? Six names change

`DEMO_GATE_PASSWORD` is **not** one of the six — its name is identical everywhere it appears, so
there is nothing to translate for Kubernetes or ECS. It simply has to reach app-bff.

`.env.example` uses **stack-level** names. The compose file renames six of them on the way into
the containers, because two services want the same value under different names and two need a
database each. **If you write Kubernetes manifests, ECS task definitions or a plain `docker run`,
you do that renaming yourself** — and four of the six fail quietly rather than loudly.

| Name in `.env.example` | Goes to | As | If you get it wrong |
|---|---|---|---|
| `GATEWAY_INTERNAL_TOKEN` | gateway | **`MC_INTERNAL_TOKEN`** | container starts, every live capability silently answers with demo data |
| `GATEWAY_INTERNAL_TOKEN` | mastercard-bff | `GATEWAY_INTERNAL_TOKEN` | same — the two MUST hold the identical value |
| `GATEWAY_DATABASE_URL` | gateway | **`DATABASE_URL`** | refuses to start |
| `APP_DB_HOST` / `APP_DB_PORT` / `APP_DB_NAME` | app-bff | **`DEMO_DB_HOST`** / **`DEMO_DB_PORT`** / **`DEMO_DB_NAME`** | refuses to start |
| `DB_USER` / `DB_PASSWORD` | app-bff | **`DEMO_DB_USER`** / **`DEMO_DB_PASSWORD`** | refuses to start |
| `GATEWAY_NODE_ENV` | gateway | **`NODE_ENV`** | production gates never run — see §6 |
| `BFF_NODE_ENV` | app-bff, mastercard-bff | **`NODE_ENV`** | as above |

Everything else keeps its name. The authoritative per-service list is the `environment:` block of
each service in [`docker-compose.yml`](docker-compose.yml) — read it as the exact set of variables
that service expects, whatever you deploy with.

Two more values are not in `.env.example` at all because compose derives them from service names:
`GATEWAY_URL` (mastercard-bff → gateway, e.g. `http://gateway:3000`) and the frontend's
`APP_BFF_URL` / `MASTERCARD_BFF_URL`. Point them at whatever your platform calls those services.

### Mounted files (gateway only)

Mount the key directory at `/app/certs` read-only. The `MC_*_PATH` variables are relative to
`/app`, so `./certs/foo.p12` resolves inside that mount.

| Purpose | Variable | Typical file |
|---|---|---|
| OAuth1 request signing | `MC_SIGNING_KEY_PATH` + `MC_SIGNING_KEY_PASSWORD` | `*-signing.p12` |
| Encrypt requests (JWE) | `MC_ENCRYPTION_CERT_PATH` | Mastercard Client Encryption cert `.pem` |
| Decrypt responses (JWE) | `MC_DECRYPTION_KEY_PATH` | our Mastercard Encryption private key `.pem` |
| Serve TLS / validate MC client cert | `TLS_KEY_PATH`, `TLS_CERT_PATH`, `TLS_CLIENT_CA_PATH` | production only, §6 |

---

## 4. Database

One Postgres server, two databases:

- **`mc_gateway`** — the gateway. Give it via `GATEWAY_DATABASE_URL`. Schema migrations run
  automatically at startup.
- **`mc_demo`** — app-bff. Given as host/port/user/password/name, not a URL. **app-bff issues
  `CREATE DATABASE` on first boot**, so the role needs `CREATEDB` — otherwise pre-create
  `mc_demo` and grant the role on it.

Run more than one gateway container and `DB_POOL_MAX` multiplies: keep
`containers × DB_POOL_MAX` under the server's `max_connections`.

---

## 5. Run

```bash
cp .env.example .env      # fill it in
mkdir -p certs            # drop the delivered Mastercard files here
docker compose up -d
docker compose ps         # all services healthy
```

To run Postgres in-stack instead of using a managed instance:

```bash
docker compose --profile with-postgres up -d
```

### Verify

```bash
curl -fsS localhost:8080/healthz                      # frontend
docker compose exec app-bff        curl -fsS localhost:4000/health
docker compose exec mastercard-bff curl -fsS localhost:4000/health   # reports live/demo wiring
docker compose exec gateway        curl -fsS localhost:3000/health
```

The BFF APIs require **two** factors on every route — the bearer token and an `X-XBS-Gate` proof;
`/health` is the only public one. To exercise them from a shell, exchange the gate password for a
proof first:

```bash
# Wrong password → 401 {"code":"gate_bad_password"}; 10 attempts per 15 min per source.
curl -i -X POST localhost:8080/demo-api/gate/verify \
  -H "Authorization: Bearer $DEMO_API_TOKEN" -H 'Content-Type: application/json' \
  -d '{"password":"wrong"}'

PROOF=$(curl -fsS -X POST localhost:8080/demo-api/gate/verify \
  -H "Authorization: Bearer $DEMO_API_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"password\":\"$DEMO_GATE_PASSWORD\"}" | sed -E 's/.*"proof":"([^"]*)".*/\1/')

# The token ALONE now returns 401 {"code":"gate_required"} — that is the point.
curl -i -H "Authorization: Bearer $DEMO_API_TOKEN" localhost:8080/demo-api/auth/me
# With both factors: 200. Try it against the other BFF too, to confirm the shared secret matches.
curl -fsS -H "Authorization: Bearer $DEMO_API_TOKEN" -H "X-XBS-Gate: $PROOF" \
  localhost:8080/demo-api/auth/me
curl -fsS -H "Authorization: Bearer $DEMO_API_TOKEN" -H "X-XBS-Gate: $PROOF" \
  localhost:8080/demo-api/xbs/balances
```

If `/demo-api/auth/me` succeeds but `/demo-api/xbs/balances` returns 401, the two services'
`DEMO_GATE_SECRET` values have drifted — that is the signature of exactly that mistake.

Then open the UI and run a payment through the Review step — an IBAN/address validation showing
"Validated · Mastercard" is a real round-trip to Mastercard.

Startup order is handled by the compose file. Starting the BFF before the gateway is finished
booting is safe: live capabilities degrade to demo responses and recover on their own.

### Logs to check on first boot

The gateway prints its effective posture on every start:

```
boot posture: NODE_ENV=… productionGates=ENFORCED|SKIPPED secretStore=… webhookMtls=… swagger=…
```

A healthy container is not evidence the production gates ran — this line is.

---

## 6. Production checklist

The first deployment intentionally runs with `GATEWAY_NODE_ENV` **empty**: the same posture that
is verified against the Mastercard sandbox today. Setting it to `production` enables gates that
**refuse to start** unless every one of these holds:

1. `MC_JWT_SECRET`, `MC_INTERNAL_TOKEN` (`GATEWAY_INTERNAL_TOKEN`), `MC_ADMIN_TOKEN` and, if
   set, `MC_WEBHOOK_TOKEN` are strong — no defaults, no short values.
2. `MC_SECRET_STORE=aws-secrets-manager`, with per-merchant credentials stored there and the
   task/instance role allowed to read them. The local store is development-only.
3. `MC_ENCRYPTION_ENABLED=true` with the encryption cert, fingerprint and decryption key set.
4. `MC_WEBHOOK_MTLS_ENABLED=true` plus `MC_WEBHOOK_ALLOWED_CLIENT_CNS` and
   `MC_WEBHOOK_ALLOWED_ISSUER_CNS`. Mastercard sends no token on push notifications — the client
   certificate is the authenticity check.
5. `TLS_KEY_PATH` and `TLS_CERT_PATH` set, so the **application** terminates TLS and can see
   Mastercard's client certificate.

### Plan the webhook path before you build the ingress

Mutual TLS on inbound push is **Mastercard's own requirement**, not a hardening choice of ours:
their Push API specification states that the connection between Mastercard and the partner server
exposing the webhook URL is established through mutual TLS. It also fixes the certificate DNs per
environment (`CrossborderServicesNotification-{mtf|prod}.mastercard.com`) and the issuing CA.

The architectural consequence, which is expensive to retrofit: **the webhook path must reach the
container as raw TCP.** TLS is terminated by the application so the guard can inspect the client
certificate — an ALB or an nginx ingress terminating TLS strips that certificate and leaves
nothing to verify. Route the webhook host/path as L4 passthrough (NLB / `ssl-passthrough`) even if
push notifications are switched on later; everything else (the web UI) can terminate normally.

Also set `TRUST_PROXY` to the number of proxy hops in front of the gateway (an ALB is `1`).
Leaving it empty behind a proxy makes IP-based rate limiting key off the proxy address.

---

## 7. Live vs demo

`mastercard-bff` decides per capability whether to call Mastercard (`live`) or synthesize a
realistic response (`demo`), via the `XBS_*_MODE` variables. Defaults match what the Mastercard
sandbox supports today: validation, balances, bank lookup, IBAN generation and cash-pickup
catalogs are live; FX quote, payment submission, status and the remaining tools stay demo until
MTF/production is enabled. Flipping one is an env change plus a restart.

Every cross-border response carries a `source: "live" | "demo"` field, and the UI shows it as a
badge — so the mode in effect is visible without reading configuration.

---

## 8. Upgrading

```bash
# edit IMAGE_TAG in .env
docker compose pull
docker compose up -d
```

Pin an immutable tag. `latest` moves between deployments and makes a rollback ambiguous.
Rolling back is the same operation with the previous tag; gateway schema migrations are
forward-only, so check with us before rolling back across a release that changed the schema.
