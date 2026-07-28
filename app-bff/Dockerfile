# syntax=docker/dockerfile:1
#
# Multi-stage image for app-bff (dist/main.js). Mirrors the gateway's Dockerfile.
# No secrets are baked in: the DB config is passed as env at runtime (see docker-compose).
# The compiled migrations ship in dist and run on boot (non-prod).

# --- build: compile TypeScript → dist (needs devDependencies: @nestjs/cli, typescript) ---
# `npm ci` (not `install`): the published image must be reproducible from the lockfile —
# `install` is free to resolve a newer dependency at build time, so two builds of the same
# commit could ship different code.
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
# NODE_ENV is deliberately NOT set — see the note in mastercard/Dockerfile. Unset behaves like
# `development` here (main.ts tests `=== 'production'`), and leaves the deployment free to
# turn the production gates on for real.
# curl: used by the healthcheck below and by the compose healthcheck against /health
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Drop root: this service writes nothing to disk and binds a port above 1024.
USER node
EXPOSE 4000
# In-image healthcheck so the liveness signal ships with the image, not just with this repo's
# compose file. start_period covers the boot-time CREATE DATABASE + migrations.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS http://localhost:${PORT:-4000}/health || exit 1
# Non-prod runs the DB migrations itself on startup (DatabaseModule.migrationsRun);
# main.ts also creates the `mc_demo` database before Nest boots.
CMD ["node", "dist/main.js"]
