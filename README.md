# @data-fair/tileserver

Vector tile server for the data-fair stack. Wraps [tileserver-gl-light](https://github.com/maptiler/tileserver-gl) and pulls tilesets and styles from a [data-fair/registry](https://github.com/data-fair/registry) instance at boot.

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REGISTRY_URL` | yes | | Base URL of the data-fair registry |
| `REGISTRY_SECRET` | yes | | Secret key for registry authentication |
| `DATA_DIR` | no | `/data` | Root directory for cache and config |
| `FONTS_DIR` | no | `/app/fonts` | Directory containing font files |
| `PORT` | no | `8080` | HTTP server port |
| `LOG_LEVEL` | no | `info` | One of `trace`, `debug`, `info`, `warn`, `error` |
| `OBSERVER_ACTIVE` | no | `true` | Enable Prometheus metrics |
| `OBSERVER_PORT` | no | `9090` | Prometheus metrics port |
| `TILESET_INCLUDE` | no | | Comma-separated list of tileset IDs to include (if set, all others are excluded) |
| `TILESET_EXCLUDE` | no | | Comma-separated list of tileset IDs to exclude |
| `TILESET_ALIASES` | no | | Comma-separated `source:key` pairs to remap tileset serving keys |
| `STYLE_INCLUDE` | no | | Comma-separated list of style IDs to include (if set, all others are excluded) |
| `STYLE_EXCLUDE` | no | | Comma-separated list of style IDs to exclude |
| `STYLE_ALIASES` | no | | Comma-separated `source:key` pairs to remap style serving names |

### Filtering and aliasing

**Include/Exclude** control which artefacts are downloaded from the registry. If `*_INCLUDE` is set, only listed IDs are kept. `*_EXCLUDE` removes listed IDs. When both are set, include is applied first, then exclude.

**Aliases** remap the serving key of an artefact without changing the downloaded file. The format is `source:key` where `source` is the artefact ID in the registry and `key` is the desired serving key.

Example: serve `france.mbtiles` under the `world` key instead of downloading `world.mbtiles`:

```bash
TILESET_EXCLUDE=world
TILESET_ALIASES=france:world
```

Example: use a timestamped tileset as a generic data layer:

```bash
TILESET_ALIASES=contours-2026:contours
```

## Development

```bash
# start dependencies (registry mock via docker)
npm run dev-deps

# start the dev server
npm run dev

# run tests
npm test

# lint and type-check
npm run quality
```
