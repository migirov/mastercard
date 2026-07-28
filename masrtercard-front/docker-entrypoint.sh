#!/bin/sh
# Container entrypoint for the frontend image.
#
# The published image is environment-agnostic: it carries no API token and no backend
# hostnames. Both are supplied as environment variables at `docker run` time and materialised
# here, before nginx starts:
#
#   1. /etc/nginx/conf.d/default.conf  <- nginx.conf.template, with the two upstreams filled in
#   2. /usr/share/nginx/html/config.js <- window.__XBS_CONFIG__ read by the SPA bundle
#
# Exits non-zero on a bad configuration rather than serving a subtly broken app.
set -eu

: "${APP_BFF_URL:=app-bff:4000}"
: "${MASTERCARD_BFF_URL:=mastercard-bff:4000}"
: "${DEMO_API_URL:=/demo-api}"
: "${DEMO_API_TOKEN:=}"

# envsubst with an EXPLICIT variable list. Without it, envsubst would also replace nginx's own
# $host / $remote_addr / $uri with empty strings and the proxy would forward a blank Host.
envsubst '${APP_BFF_URL} ${MASTERCARD_BFF_URL}' \
  < /etc/nginx/templates/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

# JSON string escaping: a token is normally URL-safe base64, but a value carrying a quote or a
# backslash would otherwise produce a config.js that fails to parse — taking the whole SPA down
# with a syntax error instead of a clear failure.
json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

cat > /usr/share/nginx/html/config.js <<EOF
// Generated at container start by docker-entrypoint.sh. Do not edit.
window.__XBS_CONFIG__ = {
  apiUrl: "$(json_escape "$DEMO_API_URL")",
  apiToken: "$(json_escape "$DEMO_API_TOKEN")"
};
EOF

if [ -z "$DEMO_API_TOKEN" ]; then
  # Not fatal: the container still serves the app and /healthz, which keeps the failure
  # diagnosable. But every API call from the browser will 401, so say so once, loudly.
  echo "frontend: WARNING - DEMO_API_TOKEN is unset; every API call from the SPA will 401" >&2
fi

echo "frontend: config -> apiUrl=${DEMO_API_URL} app-bff=${APP_BFF_URL} mastercard-bff=${MASTERCARD_BFF_URL} token=$([ -n "$DEMO_API_TOKEN" ] && echo set || echo MISSING)"

exec nginx -g 'daemon off;'
