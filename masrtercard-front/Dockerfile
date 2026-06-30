# syntax=docker/dockerfile:1
#
# Frontend image: build the Vite/React SPA, serve it with nginx (which also reverse-proxies
# the demo BFF). VITE_DEMO_API_URL is inlined at BUILD time by Vite — default /demo-api is the
# nginx-proxied path, so the browser only ever talks to this origin.

FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_DEMO_API_URL=/demo-api
ENV VITE_DEMO_API_URL=$VITE_DEMO_API_URL
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
