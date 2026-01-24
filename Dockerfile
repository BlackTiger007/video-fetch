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

# DevDependencies installieren
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

# App + node_modules kopieren
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Port freigeben
EXPOSE 3000

# Start
CMD ["node", "build"]
