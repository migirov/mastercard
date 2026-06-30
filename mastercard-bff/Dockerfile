# syntax=docker/dockerfile:1
#
# Multi-stage image for the stateless mastercard-bff (dist/main.js). Mirrors the gateway's
# Dockerfile. No secrets are baked in: the gateway token is passed as env at runtime (see
# docker-compose). No database — this service only proxies the gateway / synthesizes demo.

# --- build: compile TypeScript → dist (needs devDependencies: @nestjs/cli, typescript) ---
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# --- deps: production-only node_modules ---
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

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
EXPOSE 4000
# Stateless: no DB to create or migrate — just boot Nest and proxy the gateway.
CMD ["node", "dist/main.js"]
