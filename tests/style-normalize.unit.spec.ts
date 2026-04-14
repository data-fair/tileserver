import { test, expect } from '@playwright/test'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalizeStyle } from '../src/style-normalize.ts'

test('normalizeStyle rewrites sources, glyphs and sprite', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tileserver-style-'))
  try {
    const original = {
      version: 8,
      sources: {
        openmaptiles: { type: 'vector', url: 'mbtiles://{world}' },
        other: { type: 'vector', url: 'https://example.com/ignored.json' }
      },
      glyphs: 'https://example.com/{fontstack}/{range}.pbf',
      sprite: 'https://example.com/sprite',
      layers: []
    }
    await writeFile(join(dir, 'style.json'), JSON.stringify(original))

    await normalizeStyle({
      styleDir: dir,
      styleName: 'positron',
      tilesetIds: new Set(['world'])
    })

    const rewritten = JSON.parse(await readFile(join(dir, 'style.json'), 'utf-8'))
    expect(rewritten.sources.openmaptiles.url).toBe('mbtiles://{world}')
    expect(rewritten.sources.other.url).toBe('https://example.com/ignored.json')
    expect(rewritten.glyphs).toBe('{fontstack}/{range}.pbf')
    expect(rewritten.sprite).toBe('/sprites/positron/sprite')

    const kept = JSON.parse(await readFile(join(dir, 'style.original.json'), 'utf-8'))
    expect(kept.sprite).toBe('https://example.com/sprite')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
