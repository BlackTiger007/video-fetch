# Video Fetcher

[![Docker Pulls](https://img.shields.io/docker/pulls/blacktiger001/videofetch.svg)](https://hub.docker.com/r/blacktiger001/videofetch)

A simple web-based video download service powered by yt-dlp and a SvelteKit frontend.

## Overview

Video Fetcher provides a simple web UI for downloading videos from URLs with configurable quality options.

**Features:**

- Add videos via URL and download them directly.
- Supports multiple quality modes: `highest`, `lowest`.
- Optional custom filenames or automatic appending of the webpage title.
- Separate views for active and completed downloads.
- Web interface runs on **port 3000** by default.

## Configuration

### `DOWNLOAD_PATH`

Directory where downloaded files are stored. It is strongly recommended to mount this path as a Docker volume to ensure persistence:

```yaml
volumes:
  - ./downloads:/downloads
```

### `DATABASE_PATH`

Path where the database file is stored. It is strongly recommended to mount this path as a Docker volume:

```yaml
volumes:
  - ./data/downloads.db:/data/downloads.db
```

### `PUBLIC_DEFAULT_CONCURRENCY`

Default number of concurrent downloads.

- Default: `1`
- Example:

```env
PUBLIC_DEFAULT_CONCURRENCY=2
```

### `PUBLIC_MAX_CONCURRENCY`

Maximum number of concurrent downloads selectable in the UI. Affects **only the frontend**, not the underlying download engine.

- Default: `3`
- Example:

```env
PUBLIC_MAX_CONCURRENCY=5
```

## Usage

1. Start the container (Docker or Docker Compose).
2. Open the web interface at `http://localhost:3000`.
3. Add video URLs.
4. Select quality and optional filename settings.
5. Monitor progress in the UI.

Downloaded files will be stored in the configured `DOWNLOAD_PATH`.

## API Endpoints

### GET `/api/downloads`

Server-Sent Events (SSE) endpoint for real-time updates on active downloads:

```javascript
const eventSource = new EventSource('/api/downloads');
eventSource.onmessage = function (event) {
 console.log('New message:', event.data);
};
```

### POST `/api/add`

Adds multiple video downloads at once. Expects an array of download objects.

**Fields:**

- `videoUrl` (required): Video URL.
- `fileName` (optional): Custom filename (max 200 characters, without extension).
- `appendTitle` (optional, default: false): Append webpage title to filename.
- `quality` (optional, default: `highest`): Download quality (`highest` / `lowest`).

**Example:**

```sh
curl -X POST http://localhost:3000/api/add \
-H "Content-Type: application/json" \
-d '[
  {
    "videoUrl": "https://example.com/video1.mp4",
    "fileName": "Video1"
  },
  {
    "videoUrl": "https://example.com/video2.mp4",
    "fileName": "Video2"
  }
]'
```

## Docker

### Run directly

```bash
docker run -d \
  --name videofetch \
  -p 3000:3000 \
  -v /absolute/path/to/downloads:/downloads \
  -v /absolute/path/to/data/downloads.db:/data/downloads.db \
  blacktiger001/videofetch
```

**Notes:**

- Use absolute paths for both volumes.
- Check logs: `docker logs videofetch`.

### Docker Compose

```yaml
services:
  videofetch:
    image: blacktiger001/videofetch
    container_name: videofetch
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ./downloads:/downloads
      - ./data/downloads.db:/data/downloads.db
```

**Start:**

```bash
docker-compose up -d
```

**Check logs:**

```bash
docker-compose logs -f videofetch
```

## Notes

- Project is experimental.
- Unexpected behavior may occur.
- Bug reports and issue submissions are welcome.
