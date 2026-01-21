# Video Fetcher

A simple video download service with a SvelteKit frontend.

## Description

* Videos can be added and downloaded via URL.
* Supports different quality options: `best`, `worst`, or audio-only.
* Optionally, a custom filename can be set or the webpage title can be appended.
* Ongoing and completed downloads are displayed separately.
* **Web interface runs on port 3000 by default.**

**Note:** Settings and ongoing downloads are **not persisted**. If the container is stopped or restarted, this data will be lost.

## Configuration

* **DOWNLOAD_PATH**: Path where downloaded videos are saved.
  Should be mounted as a Docker volume to keep files persistent:

```yaml
volumes:
  - ./downloads:/app/downloads
```

* **PUBLIC_MAX_CONCURRENCY**: Sets the maximum number of concurrent downloads in the frontend (slider).
  This is **only a UI limit**, not a limit for the actual engine. Example:

```env
PUBLIC_MAX_CONCURRENCY=5
```

## Usage

* Start the container as usual with Docker.
* Add URLs via the web interface, choose quality, and optionally set a filename or append the page title.
* Progress and status are displayed in the frontend.
* Downloaded videos are located in the `DOWNLOAD_PATH`.

## Notes

* Project is experimental and not fully tested.
* Errors or unexpected behavior may occur.
* Bugs or issues are welcome to be reported.
