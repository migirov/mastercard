# syntax=docker/dockerfile:1
#
# Multi-stage image for the embeddable Mastercard Cross-Border gateway, run via its dev
# harness (dist/harness/main.js). Secrets are NOT baked in: the sandbox certs are mounted
# read-only and the configuration is passed as env at runtime (see docker-compose.yml).

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
ENV NODE_ENV=development
# curl: used by the compose healthcheck against /health
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
# Non-prod harness runs the DB migrations itself on startup (DatabaseModule.migrationsRun).
CMD ["node", "dist/harness/main.js"]
