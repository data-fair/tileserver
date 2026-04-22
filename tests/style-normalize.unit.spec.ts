import { test, expect } from '@playwright/test'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalizeStyle } from '../src/style-normalize.ts'

const baseStyle = () => ({
  version: 8,
  sources: {
    openmaptiles: { type: 'vector', url: 'mbtiles://{world}' },
    other: { type: 'vector', url: 'https://example.com/ignored.json' }
  },
  glyphs: 'https://example.com/{fontstack}/{range}.pbf',
  sprite: 'https://example.com/sprite',
  layers: []
})

test('normalizeStyle rewrites sources and glyphs, points sprite at local folder when present', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tileserver-style-'))
  try {
    await writeFile(join(dir, 'style.json'), JSON.stringify(baseStyle()))
    await mkdir(join(dir, 'sprites'))
    await writeFile(join(dir, 'sprites', 'sprite.json'), '{}')
    await writeFile(join(dir, 'sprites', 'sprite.png'), '')

    await normalizeStyle({
      styleDir: dir,
      tilesetKeys: new Map([['world', 'world']])
    })

    const rewritten = JSON.parse(await readFile(join(dir, 'style.json'), 'utf-8'))
    expect(rewritten.sources.openmaptiles.url).toBe('mbtiles://{world}')
    expect(rewritten.sources.other.url).toBe('https://example.com/ignored.json')
    expect(rewritten.glyphs).toBe('{fontstack}/{range}.pbf')
    expect(rewritten.sprite).toBe('{styleJsonFolder}/sprites/sprite')

    const kept = JSON.parse(await readFile(join(dir, 'style.original.json'), 'utf-8'))
    expect(kept.sprite).toBe('https://example.com/sprite')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('normalizeStyle drops sprite field when no local sprite is packaged', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tileserver-style-'))
  try {
    await writeFile(join(dir, 'style.json'), JSON.stringify(baseStyle()))

    await normalizeStyle({
      styleDir: dir,
      tilesetKeys: new Map([['world', 'world']])
    })

    const rewritten = JSON.parse(await readFile(join(dir, 'style.json'), 'utf-8'))
    expect(rewritten.sprite).toBeUndefined()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
