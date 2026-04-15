# data-fair/tileserver — Architecture

## 1. Purpose & position in the data-fair stack

`data-fair/tileserver` serves vector tiles, glyphs and sprites for the data-fair platform. It is a standard Node.js service that embeds [`tileserver-gl-light`](https://www.npmjs.com/package/tileserver-gl-light) (v4+, BSD-2-Clause) as a regular npm dependency and runs it in-process. At boot, the service connects to a sibling **data-fair/registry** instance, auto-discovers available tilesets and styles, downloads them into a local cache via `@data-fair/lib-node-registry`, builds a coherent tileserver config, and starts the embedded Express app. The image itself ships **no map data and no styles** — everything is pulled at runtime from the registry.

This differs from `koumoul/tileserver-gl`, which pre-bundles OpenMapTiles styles, fonts and mbtiles into a third-party base image. The registry-driven, pure-JS model keeps the image small, the licensing surface clean, and the deployed content controlled by the registry rather than by image tags.

**Why `tileserver-gl-light` and not full `tileserver-gl`.** The light variant is pure JavaScript with no native dependencies; it serves vector tiles, TileJSON, glyphs and sprites, but does **not** perform server-side raster rendering (the `/styles/:id/:z/:x/:y.{png,jpg,webp}` endpoints). data-fair consumers render tiles client-side with MapLibre GL JS, so the raster endpoints are unused. Dropping them removes `@maplibre/maplibre-gl-native` and its toolchain from the image, lets us base on a standard `node:*-alpine` image, and eliminates the historical reasons for maintaining a forked base image.

## 2. Licensing notes

| Component                        | License        | Notes                                                                   |
|----------------------------------|----------------|-------------------------------------------------------------------------|
| This service                     | AGPL-3.0       | Matches the rest of the data-fair family.                               |
| `tileserver-gl-light` (v4+)      | BSD-2-Clause   | Embedded as an npm dependency; preserve its LICENSE in the image.       |
| `@data-fair/lib-node-registry`   | AGPL-3.0       | Provides `ensureArtefact()`.                                            |
| Runtime-fetched mbtiles          | Typically ODbL (OSM-derived) | Not redistributed by this image. Attribution served by tileserver-gl from mbtiles metadata. |
| Runtime-fetched styles/fonts     | Typically CC0 / OFL          | Delivered by the registry; licensing is a concern of each artefact.     |

> **Pin `tileserver-gl-light` v4+.** Pre-v4 releases depended on the Mapbox GL ecosystem under Mapbox's proprietary TOS and are not redistributable. v4+ switched to MapLibre. The light variant has no native rendering component, so no `@maplibre/maplibre-gl-native` is ever installed.

Because the image contains zero third-party map data, redistribution obligations (ODbL share-alike, attribution, etc.) do not apply to the image layer. They apply to the content served by the running container, and are satisfied by tileserver-gl's built-in attribution handling plus whatever the registry's style/tileset artefacts declare.

## 3. Runtime architecture

```
                ┌────────────────────────────────────────────────┐
                │            data-fair/tileserver                │
                │                                                │
 env vars  ───► │   ┌────────┐    ┌────────────────┐             │
 (REGISTRY_URL, │   │ config │───►│ registry-client│────HTTP────►│──► data-fair/registry
  SECRET, ...)  │   └────────┘    └───────┬────────┘             │    GET /api/v1/artefacts
                │                         │                      │    GET /api/v1/artefacts/:id/download
                │                         ▼                      │    GET /api/v1/artefacts/:id/versions/:v/tarball
                │              ┌──────────────────────┐          │
                │              │ ensureArtefact()     │          │
                │              │ (lib-node-registry)  │          │
                │              └──────────┬───────────┘          │
                │                         │                      │
                │                         ▼                      │
                │              /data/cache/{tilesets,styles,...} │
                │                         │                      │
                │                         ▼                      │
                │              ┌──────────────────────┐          │
                │              │   build-config       │          │
                │              │   → /data/config.json│          │
                │              └──────────┬───────────┘          │
                │                         │                      │
                │                         ▼                      │
                │              ┌──────────────────────┐          │
                │              │ tileserver-gl-light  │──► :PORT │──► tiles/, styles/, fonts/, sprites/
                │              │ (Express app,        │          │
                │              │  in-process)         │          │
                │              └──────────────────────┘          │
                └────────────────────────────────────────────────┘
```

A single Node.js process owns the whole lifecycle: it performs the registry sync, then mounts the embedded `tileserver-gl-light` Express app and calls `.listen()`. PID 1 is the wrapper itself, so signals, logs, and healthchecks are under our control — there is no `execvp` handoff to a foreign binary.

## 4. Environment variables

| Variable          | Required | Default        | Purpose                                                                 |
|-------------------|----------|----------------|-------------------------------------------------------------------------|
| `REGISTRY_URL`    | yes      | —              | Base URL of the data-fair/registry instance.                            |
| `REGISTRY_SECRET` | yes      | —              | Secret passed as `x-secret-key` for download endpoints.                 |
| `DATA_DIR`        | no       | `/data`        | Root of the persistent volume (cache + generated `config.json`).        |
| `PORT`            | no       | `8080`         | Port the embedded tileserver-gl-light app binds to.                     |
| `LOG_LEVEL`       | no       | `info`         | Log level for the wrapper.                                              |

Additional `TILESERVER_*` passthroughs may be added later as needed. v1 keeps the surface minimal.

## 4a. Runtime image

The image is a standard Node.js service image:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
USER node
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "src/index.ts"]
```

`tileserver-gl-light` is declared in `package.json` alongside `@data-fair/lib-node-registry`, `zod`, and the standard data-fair Node tooling. There is no dependency on `ubuntu:focal`, no forked base image, and no native build step. A `USER node` line and a `HEALTHCHECK` hitting the tileserver-gl-light health endpoint (or a thin `/health` route added by the wrapper) are the only hardening the image needs.

## 5. Startup sequence

1. Parse env via a zod schema; fail fast on missing `REGISTRY_URL` / `REGISTRY_SECRET`.
2. Ensure `${DATA_DIR}/cache/{tilesets,styles,fonts,sprites}` exist.
3. List tilesets: `GET ${REGISTRY_URL}/api/v1/artefacts?category=tileset&format=file&size=1000` (single request — we never expect more than that many).
4. List styles: `GET ${REGISTRY_URL}/api/v1/artefacts?category=style&size=1000` (npm-packaged artefacts).
5. For each tileset: `ensureArtefact({ artefactId: t._id, cacheDir })` → yields a local `.mbtiles` path.
6. For each style: resolve the latest version via `GET /api/v1/artefacts/:id/versions/latest` (or equivalent), then `ensureArtefact({ artefactId, version, cacheDir })`. The helper extracts the tarball atomically.
7. Normalize each extracted style: parse its `style.json`, rewrite `glyphs` / `sprite` / `sources` entries to point at the locally cached files (see §7), and write the normalized copy next to the original.
8. Build the tileserver config in memory (see §8). Also serialize it to `${DATA_DIR}/config.json` for debuggability — tileserver-gl-light is still fed the in-memory object, the on-disk copy is purely informational.
9. `require('tileserver-gl-light')` → obtain the Express app factory, instantiate it with the in-memory config (and resolved `port` option), then `app.listen(PORT)`. Absolute URLs in TileJSON / style responses are derived per-request from `X-Forwarded-Host` and `X-Forwarded-Proto`, matching the data-fair multi-domain convention (cf. `@data-fair/lib-express/req-origin`). The wrapper stays PID 1 and handles `SIGTERM`/`SIGINT` by closing the HTTP server cleanly.

If any fetch fails, the service logs the offending artefact and exits non-zero — the container is expected to be restarted by its orchestrator, or redeployed once the registry state is fixed.

> **Programmatic API caveat.** If `tileserver-gl-light` does not expose a stable programmatic entry point in the version we pin, fall back to spawning `node node_modules/tileserver-gl-light/src/main.js --config ${DATA_DIR}/config.json --port ${PORT}` from the same process (child process, not `execvp`). This keeps the image and dependency story identical; only the startup mechanics change. A spike on the pinned version settles this before v1.

## 6. Registry API contract

The wrapper depends on the following registry endpoints. These are stable contracts of `data-fair/registry` and must not drift silently.

| Method | Path                                                         | Purpose                        | Auth             |
|--------|--------------------------------------------------------------|--------------------------------|------------------|
| GET    | `/api/v1/artefacts?category=tileset&format=file&size&skip`   | List tileset file artefacts    | none (public) or `x-secret-key` |
| GET    | `/api/v1/artefacts?category=style&size&skip`                 | List style npm artefacts       | none or `x-secret-key` |
| GET    | `/api/v1/artefacts/:id`                                      | Artefact metadata              | as above         |
| GET    | `/api/v1/artefacts/:id/download`                             | Download `.mbtiles`            | `x-secret-key`   |
| GET    | `/api/v1/artefacts/:id/versions/:version`                    | Resolve style version          | as above         |
| GET    | `/api/v1/artefacts/:id/versions/:version/tarball`            | Download style tarball         | `x-secret-key`   |

In practice, the wrapper does not call the download endpoints directly — `ensureArtefact()` from `@data-fair/lib-node-registry` wraps them, handles caching and atomic extraction. The wrapper only performs the listing calls itself.

## 7. Style tarball layout

Style artefacts are npm tarballs published to the registry. Each package is expected to look like:

```
<pkg>/
├── package.json          # name, version, registry.category === "style"
├── style.json            # MapLibre style spec
├── sprites/              # optional
│   ├── sprite.json
│   ├── sprite.png
│   ├── sprite@2x.json
│   └── sprite@2x.png
└── fonts/                # optional, one dir per font family
    └── Noto Sans Regular/
        ├── 0-255.pbf
        └── ...
```

At normalize time, the wrapper rewrites `style.json` so that:

- `sources` whose URL uses a `mbtiles://` scheme (or references a tileset artefact id) are rewritten to `mbtiles://{<tileset-id>}`, which tileserver-gl then resolves through its `data` config entries.
- `glyphs` is rewritten to `{fontstack}/{range}.pbf` (served from the style's own extracted `fonts/` if present, else from a global `fonts/` directory).
- `sprite` is rewritten to a local URL rooted at the extracted `sprites/` directory.

This mirrors what `koumoul/tileserver-gl/scripts/prepare-styles.sh` does with `sed`, except it runs in-process on freshly fetched content at container startup rather than at image build time.

## 8. Generated `config.json`

tileserver-gl's config format is three top-level keys: `options`, `styles`, `data`. Example emitted by the wrapper:

```json
{
  "options": {
    "paths": {
      "root": "/data",
      "mbtiles": "/data/cache/tilesets",
      "styles":  "/data/cache/styles",
      "fonts":   "/data/cache/fonts",
      "sprites": "/data/cache/sprites"
    },
    "serveAllStyles": false,
    "serveAllFonts":  true,
    "formatQuality":  { "jpeg": 80, "webp": 90 }
  },
  "styles": {
    "positron":    { "style": "positron/style.json" },
    "dark-matter": { "style": "dark-matter/style.json" }
  },
  "data": {
    "world":    { "mbtiles": "world.mbtiles" },
    "cadastre": { "mbtiles": "cadastre.mbtiles" }
  }
}
```

- Each tileset artefact becomes one entry under `data`, keyed by its artefact `_id`.
- Each style artefact becomes one entry under `styles`, keyed by its package name (without the `@scope/` prefix if any), pointing at the normalized `style.json` inside the extracted tarball.
- `options.paths` point at subdirectories of `${DATA_DIR}/cache`.

## 9. Cache and volume layout

The container expects a single writable volume at `${DATA_DIR}` (default `/data`):

```
/data/
├── config.json              # generated at startup, overwritten each boot
└── cache/
    ├── tilesets/            # .mbtiles files (one per tileset artefact)
    │   ├── world.mbtiles
    │   └── cadastre.mbtiles
    ├── styles/              # one directory per extracted style tarball
    │   ├── positron/
    │   │   ├── style.json           # normalized (rewritten URLs)
    │   │   ├── style.original.json  # optional: as-fetched copy
    │   │   ├── sprites/
    │   │   └── fonts/
    │   └── dark-matter/
    ├── fonts/               # optional shared font fallback
    └── sprites/              # optional shared sprite fallback
```

`ensureArtefact()` from `@data-fair/lib-node-registry` is responsible for making each fetch idempotent: if the artefact at the requested version is already on disk, it's reused; if a newer version is pulled, the previous one is cleaned up. This means a container restart with an unchanged registry is a near no-op, while a registry change is picked up on the next restart.
