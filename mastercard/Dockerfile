# syntax=docker/dockerfile:1
#
# Multi-stage image for the embeddable Mastercard Cross-Border gateway, run via its dev
# harness (dist/harness/main.js). Secrets are NOT baked in: the sandbox certs are mounted
# read-only and the configuration is passed as env at runtime (see docker-compose.yml).

# Node 20 is not an arbitrary pin: package.json declares `engines: node >=20 <23`, and the
# minimum TLS version the app relies on (src/common/utils/tls.ts) is argued from the runtime
# major. Moving this base image outside that range would invalidate that argument silently —
# there is no .npmrc, so `engine-strict` is off and npm will not object.
#
# --- build: compile TypeScript → dist (needs devDependencies: @nestjs/cli, typescript) ---
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# --- deps: production-only node_modules (typeorm is a runtime dep — migrations run on boot) ---
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- runtime ---
FROM node:20-slim AS runtime
WORKDIR /app
# NODE_ENV is deliberately NOT set here. Baking `development` into an image that ships to a
# production host is both misleading and in the way: an image-level ENV wins over anything the
# orchestrator does not explicitly pass, so an operator enabling the production gates could not
# be sure they took effect. Unset behaves identically to `development` for every gate in this
# codebase (they all test `=== 'production'`), and `NODE_ENV=production` at deploy time now
# does exactly what it says. The gates are listed in src/harness/main.ts.
# curl: used by the healthcheck below and by the compose healthcheck against /health
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Drop root: nothing here writes to disk (the local secret store only READS
# secrets.local.json) and the port is above 1024, so the runtime needs no privilege.
USER node
EXPOSE 3000
# In-image healthcheck so the liveness signal travels with the image, rather than living only
# in this repo's compose file — the deployment target may be ECS/k8s/plain `docker run`.
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS http://localhost:${PORT:-3000}/health || exit 1
# Non-prod harness runs the DB migrations itself on startup (DatabaseModule.migrationsRun).
CMD ["node", "dist/harness/main.js"]
