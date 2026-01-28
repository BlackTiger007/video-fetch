# --- Build Stage ---
FROM node:24.12.0-slim
WORKDIR /app

RUN apt-get update && \
    apt-get install -y ffmpeg curl unzip && \
    ln -s $(which ffmpeg) /usr/local/bin/ffmpeg && \
    npm install -g pnpm && \
    mkdir -p /usr/local/bin && \
    # yt-dlp
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    # Deno
    curl -fsSL https://deno.land/x/install/install.sh | sh && \
    ln -s /root/.deno/bin/deno /usr/local/bin/deno

ENV CI=true

COPY . .

RUN mkdir -p /app/data

RUN pnpm install --frozen-lockfile --prod=false

RUN pnpm run build
RUN pnpm prune --production

# --- Production Stage ---
FROM node:24.12.0-slim
WORKDIR /app

# Runtime-Tools + yt-dlp + Deno
RUN apt-get update && \
    apt-get install -y ffmpeg curl unzip && \
    # yt-dlp
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    # Deno
    curl -fsSL https://deno.land/x/install/install.sh | sh && \
    # Deno in PATH setzen
    ln -s /root/.deno/bin/deno /usr/local/bin/deno

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
ENV PATH="$PATH:/root/.deno/bin" 

# Port freigeben
EXPOSE 3000

# Migration + App starten
CMD ["sh", "-c", "npx drizzle-kit migrate --config drizzle.config.ts && node build"]