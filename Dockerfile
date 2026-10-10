FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
# ffmpeg aus den Paketquellen statt des Downloads von ffmpeg-static
ENV FFMPEG_BIN=/usr/bin/ffmpeg
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM base AS run
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json /app/next.config.ts ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts ./scripts
# Für scripts/create-admin.ts, das Namen und Passwort-Hash aus dem App-Code nutzt
COPY --from=build --chown=node:node /app/src/lib ./src/lib
USER node
EXPOSE 3000
# Coolify übernimmt diesen Healthcheck und schaltet erst auf den neuen Container um, wenn er gesund
# ist. Die Wartezeit deckt die Migrationen beim Start ab.
HEALTHCHECK --interval=10s --timeout=5s --start-period=120s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1
# Erst die Migrationen, dann der Server. exec, damit der Server die Signale zum Beenden bekommt.
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node_modules/.bin/next start --hostname 0.0.0.0 --port ${PORT:-3000}"]
