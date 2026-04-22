import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

interface StyleJson {
  sources?: Record<string, { url?: string, tiles?: string[], type?: string, [k: string]: unknown }>
  glyphs?: string
  sprite?: string | Array<{ id: string, url: string }>
  [k: string]: unknown
}

export interface NormalizeOpts {
  styleDir: string
  styleName: string
  tilesetKeys: Map<string, string>
}

export const normalizeStyle = async ({ styleDir, styleName, tilesetKeys }: NormalizeOpts): Promise<void> => {
  const stylePath = join(styleDir, 'style.json')
  const raw = await readFile(stylePath, 'utf-8')
  const style: StyleJson = JSON.parse(raw)

  await writeFile(join(styleDir, 'style.original.json'), raw)

  if (style.sources) {
    for (const [key, source] of Object.entries(style.sources)) {
      const ref = typeof source.url === 'string' ? source.url : undefined
      if (!ref) continue
      const match = ref.match(/^(?:mbtiles:\/\/\{?|artefact:)([^}]+)\}?$/)
      const id = match?.[1] ?? ref
      const resolved = tilesetKeys.get(id)
      if (resolved) {
        style.sources[key] = { ...source, url: `mbtiles://{${resolved}}` }
      }
    }
  }

  style.glyphs = '{fontstack}/{range}.pbf'
  style.sprite = `/sprites/${styleName}/sprite`

  await writeFile(stylePath, JSON.stringify(style, null, 2))
}
