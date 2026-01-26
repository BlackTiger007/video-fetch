# --- Build Stage ---
FROM node:20.19.5-slim AS builder
WORKDIR /app

# Systemtools + pnpm
RUN apt-get update && \
    apt-get install -y build-essential python3 ffmpeg curl git && \
    npm install -g pnpm

# CI=true setzen, damit pnpm ohne TTY läuft
ENV CI=true

# Code kopieren
COPY . .

# Dependencies installieren
RUN pnpm install --frozen-lockfile --prod=false

# SvelteKit Build
RUN pnpm run build
RUN pnpm prune --production

# --- Production Stage ---
FROM node:20.19.5-slim
WORKDIR /app

# Runtime-Tools + yt-dlp
RUN apt-get update && \
    apt-get install -y ffmpeg curl && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Build und node_modules kopieren
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/drizzle drizzle/

# Ordner für SQLite erstellen
RUN mkdir -p /app/data

# ALTES SQLITE DATA ENTFERNEN UND LEEREN
RUN rm -rf data/*

# Environment-Variablen setzen
ENV NODE_ENV=production
ENV PUBLIC_DEFAULT_CONCURRENCY=1
ENV PUBLIC_MAX_CONCURRENCY=5
ENV DOWNLOAD_PATH=/app/downloads
ENV DATABASE_PATH=/app/data/downloads.db

# Port freigeben
EXPOSE 3000

# Migration + App starten
CMD ["sh", "-c", "npx drizzle-kit migrate --config drizzle.config.ts && node build"]