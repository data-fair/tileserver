# Tileserver

Vector tile server wrapping `tileserver-gl-light`. Pulls tilesets (mbtiles) and styles (maplibre) from a `data-fair/registry` instance at boot, then serves tiles, styles, fonts, and sprites over HTTP.

## Stack

- **Runtime**: Node.js with TypeScript (ts extensions, no build step — run directly via `node --experimental-strip-types`)
- **Framework**: Express 5
- **Tile engine**: `tileserver-gl-light` (started on ephemeral port, inner server closed, express app reused as middleware)
- **Config validation**: Zod (`src/config.ts` parses `process.env`)
- **Tests**: Playwright Test (not browser tests — API + unit tests using playwright's runner)
- **Lint**: ESLint via neostandard
- **Commits**: Conventional commits enforced by commitlint + husky

## Project layout

```
src/
  index.ts          # Entrypoint — starts server, handles signals
  config.ts         # Zod env parsing, exports typed config singleton
  log.ts            # Minimal leveled logger (trace/debug/info/warn/error)
  server.ts         # HTTP server lifecycle (start/stop)
  app.ts            # Express app — helmet, health endpoint, tileserver-gl middleware
  build-config.ts   # Fetches artefacts from registry, applies include/exclude/aliases, writes tileserver-gl config.json
  registry-client.ts # Axios wrapper for registry API
  style-normalize.ts # Rewrites style.json (sources, glyphs, sprites) for local serving
tests/
  *.api.spec.ts     # Integration tests (hit running tileserver)
  *.unit.spec.ts    # Unit tests (no server needed)
  support/
    global-setup.ts # Spawns mock registry + tileserver process in tmpdir
    global-teardown.ts
    mock-registry.ts # Express mock of the registry API
    fixtures.ts     # Builds test mbtiles and style tarballs
  fixtures/         # Static fixture data (style JSON, etc.)
```

## Key commands

```bash
npm run dev          # Start dev server with nodemon
npm run dev-deps     # Start docker dependencies
npm test             # Run all tests (playwright test)
npm run lint         # ESLint
npm run check-types  # tsc --noEmit
npm run quality      # lint + types + tests
```

## Environment variables

Core: `REGISTRY_URL`, `REGISTRY_SECRET`, `DATA_DIR`, `FONTS_DIR`, `PORT`, `LOG_LEVEL`.

Filtering & aliases (comma-separated):
- `TILESET_INCLUDE` / `TILESET_EXCLUDE` — whitelist/blacklist tileset IDs
- `TILESET_ALIASES` — `alias:source` pairs to remap tileset serving keys
- `STYLE_INCLUDE` / `STYLE_EXCLUDE` / `STYLE_ALIASES` — same for styles

## Testing

Tests use a real tileserver process spawned against a mock registry (see `tests/support/global-setup.ts`). The mock serves fixture mbtiles and style tarballs. Test logs go to `dev/logs/test-tileserver.log`.

To add env-var-dependent tests (include/exclude/aliases), pass the relevant env vars in the `global-setup.ts` spawn call.

## Imports

Uses Node.js subpath imports (`#config`, `#log`) defined in `package.json` `"imports"` field.
