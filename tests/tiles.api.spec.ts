import { test, expect } from '@playwright/test'
import { anonymousAx } from './support/axios.ts'

test('GET /data.json lists the tileset from the mock registry', async () => {
  const res = await anonymousAx.get('/data.json')
  expect(res.status).toBe(200)
  expect(Array.isArray(res.data)).toBe(true)
  // `id` here comes from the mbtiles filename (which keeps the `tileset-` prefix);
  // the serving key (used in /data/<key>.json URLs) is the stripped form, asserted separately.
  const ids = (res.data as Array<{ id: string }>).map(e => e.id)
  expect(ids).toContain('tileset-world')
})

test('GET /data/world.json returns TileJSON with fixture metadata', async () => {
  const res = await anonymousAx.get('/data/world.json')
  expect(res.status).toBe(200)
  const tj = res.data as {
    format: string
    minzoom: number
    maxzoom: number
    bounds: number[]
    vector_layers?: unknown[]
  }
  expect(tj.format).toBe('pbf')
  expect(tj.minzoom).toBe(0)
  expect(tj.maxzoom).toBe(2)
  expect(tj.bounds).toEqual([-180, -85.0511, 180, 85.0511])
  expect(Array.isArray(tj.vector_layers)).toBe(true)
})

test('GET /styles.json lists the style from the mock registry', async () => {
  const res = await anonymousAx.get('/styles.json')
  expect(res.status).toBe(200)
  const ids = (res.data as Array<{ id: string }>).map(e => e.id)
  expect(ids).toContain('basic')
})

test('GET /styles/basic/style.json returns the normalized style', async () => {
  const res = await anonymousAx.get('/styles/basic/style.json')
  expect(res.status).toBe(200)
  const style = res.data as {
    glyphs: string
    sprite: string
    sources: Record<string, { url?: string }>
  }
  // style-normalize.ts strips the upstream URLs; tileserver-gl-light then rewrites the
  // stripped paths and the `mbtiles://` source URL to absolute local URLs at serve time.
  expect(style.glyphs).toContain('{fontstack}/{range}.pbf')
  expect(style.glyphs).not.toContain('example.invalid')
  expect(style.sprite).toContain('/styles/basic/sprite')
  expect(style.sprite).not.toContain('example.invalid')
  expect(style.sources.openmaptiles.url).toContain('/data/world.json')
})
