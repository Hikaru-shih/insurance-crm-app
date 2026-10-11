FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS web-build
COPY . .
ENV EXPO_PUBLIC_API_URL="" EXPO_NO_TELEMETRY=1 CI=1
RUN npm run build:web

FROM node:24-bookworm-slim AS api
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY src/domain ./src/domain
COPY scripts/backup.ts scripts/bootstrap-admin.ts ./scripts/
RUN mkdir /data && chown node:node /data
USER node
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=3001
EXPOSE 3001
CMD ["node", "--import", "tsx", "server/index.ts"]

FROM caddy:2 AS web
COPY --from=web-build /app/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
