FROM node:24-bookworm-slim AS build

WORKDIR /app

# better-sqlite3 may need to compile a native addon when no matching prebuild is available.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends g++ make python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
  LIFTIN_DB_PATH=/liftin/BelloDataModel.sqlite \
  PORT=3000

RUN groupadd --system --gid 10001 cliftin \
  && useradd --system --uid 10001 --gid cliftin --home-dir /app --no-create-home cliftin

WORKDIR /app
COPY --from=build --chown=cliftin:cliftin /app/node_modules ./node_modules
COPY --from=build --chown=cliftin:cliftin /app/dist ./dist
COPY --from=build --chown=cliftin:cliftin /app/package.json ./package.json

USER cliftin

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then((response) => { if (!response.ok) process.exit(1); return response.json() }).then((body) => { if (body.status !== 'ok') process.exit(1) }).catch(() => process.exit(1))"]

CMD ["node", "dist/server.js"]
