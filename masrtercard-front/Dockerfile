# syntax=docker/dockerfile:1
#
# Frontend image: build the Vite/React SPA, serve it with nginx (which also reverse-proxies
# the BFFs). The image is ENVIRONMENT-AGNOSTIC — it holds no API token and no backend
# hostnames. Both are supplied as environment variables at container start and materialised by
# docker-entrypoint.sh into /config.js and the nginx config. That is what makes one published
# image deployable anywhere: nothing here has to be rebuilt to change a token.

FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS runtime
# gettext: provides envsubst, used by the entrypoint to fill the nginx template.
RUN apk add --no-cache gettext
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template
# /entrypoint.sh, not /docker-entrypoint.sh: the nginx base image owns the latter.
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80
# Runtime configuration (defaults match the compose stack; override per deployment):
#   DEMO_API_TOKEN     shared bearer token for both BFFs — REQUIRED, no default
#   DEMO_API_URL       base path the SPA calls (default /demo-api, proxied by this nginx)
#   APP_BFF_URL        host:port of app-bff        (default app-bff:4000)
#   MASTERCARD_BFF_URL host:port of mastercard-bff (default mastercard-bff:4000)
# 127.0.0.1, not `localhost`: nginx here listens on IPv4 only, and busybox wget resolves
# `localhost` to ::1 first and gives up on connection-refused instead of falling back to IPv4 —
# so the probe failed against a perfectly healthy server. (curl, used by the Node images, does
# fall back; wget does not.)
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
ENTRYPOINT ["/entrypoint.sh"]
