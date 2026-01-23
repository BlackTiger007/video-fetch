# Video Fetcher

[![Docker Pulls](https://img.shields.io/docker/pulls/blacktiger001/videofetch.svg)](https://hub.docker.com/r/blacktiger001/videofetch)

A simple web-based video download service powered by yt-dlp, featuring a SvelteKit frontend.

## Overview

Video Fetcher provides a simple web UI for downloading videos from URLs with configurable quality options.

### Features

- Add videos via URL and download them directly.
- Supports multiple quality modes: `best`, `worst`, and audio-only.
- Optional custom filenames or automatic appending of the webpage title.
- Separate views for active and completed downloads.
- Web interface runs on **port 3000** by default.

**Important:**  
Application state (settings and active downloads) is **not persisted**. Stopping or restarting the container will reset this data.

## Configuration

### `DOWNLOAD_PATH`

Directory where downloaded files are stored.  
It is strongly recommended to mount this path as a Docker volume to ensure persistence:

```yaml
volumes:
  - ./downloads:/app/downloads
```

### `DATABASE_PATH`

Path where the database file is stored.
It is strongly recommended to mount this path as a Docker volume to ensure data persistence:

```yaml
volumes:
  - ./data/downloads.db:/data/downloads.db
```

### `PUBLIC_DEFAULT_CONCURRENCY`

Defines the default number of concurrent downloads.

- Default: `1`
- Example:

```env
PUBLIC_DEFAULT_CONCURRENCY=2
```

### `PUBLIC_MAX_CONCURRENCY`

Defines the maximum number of concurrent downloads selectable in the frontend UI (slider).
This affects **only the UI**, not the underlying download engine.

- Default: `3`
- Example:

```env
PUBLIC_MAX_CONCURRENCY=5
```

## Usage

1. Start the container using Docker or Docker Compose.
2. Open the web interface.
3. Add one or more video URLs.
4. Select the desired quality and optional filename settings.
5. Monitor progress and status directly in the UI.

Downloaded files will be available in the configured `DOWNLOAD_PATH`.

## Running with Docker

```cmd
docker run -d \
  -p 3000:3000 \
  -v /path/downloads:/app/downloads \
  blacktiger001/videofetch
```

## Running with Docker Compose

```yaml
services:
  videofetch:
    image: blacktiger001/videofetch
    container_name: videofetch
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - /path/downloads:/app/downloads
```

## Notes

- This project is experimental and not yet fully tested.
- Unexpected behavior or errors may occur.
- Bug reports and issue submissions are welcome.
