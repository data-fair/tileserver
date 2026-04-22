import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join, relative } from 'node:path'
import { ensureArtefactFile, extractTarball } from '@data-fair/lib-node-registry'
import config from '#config'
import log from '#log'
import { listArtefacts, type Artefact } from './registry-client.ts'
import { normalizeStyle } from './style-normalize.ts'
import { filterArtefacts } from './config-parse.ts'

export interface TileserverConfig {
  options: {
    paths: {
      root: string
      mbtiles: string
      styles: string
      fonts: string
      sprites: string
    }
    serveAllStyles: boolean
    serveAllFonts: boolean
    formatQuality: { jpeg: number, webp: number }
  }
  styles: Record<string, { style: string }>
  data: Record<string, { mbtiles: string }>
}

const stripTilesetPrefix = (id: string): string => id.replace(/^tileset-/, '')
const stripStylePrefix = (name: string): string => name.replace(/^maplibre-style-/, '')

const stylePackageName = (a: Artefact): string => {
  const name = a.name.replace(/^@[^/]+\//, '')
  return stripStylePrefix(name.replace(/[^a-z0-9_-]/gi, '-'))
}

export const buildTileserverConfig = async (): Promise<TileserverConfig> => {
  const cacheRoot = join(config.dataDir, 'cache')
  const dirs = {
    root: config.dataDir,
    mbtiles: join(cacheRoot, 'tilesets'),
    styles: join(cacheRoot, 'styles'),
    fonts: config.fontsDir,
    sprites: join(cacheRoot, 'sprites')
  }
  for (const d of [dirs.root, dirs.mbtiles, dirs.styles, dirs.sprites]) await mkdir(d, { recursive: true })
  const styleTarballs = join(cacheRoot, 'style-tarballs')
  await mkdir(styleTarballs, { recursive: true })

  log.info('listing tilesets from registry...')
  const tilesets = await listArtefacts({ category: 'tileset', format: 'file' })
  log.info(`found ${tilesets.length} tilesets`)

  log.info('listing styles from registry...')
  const styles = await listArtefacts({ category: 'maplibre-style', format: 'file' })
  log.info(`found ${styles.length} styles`)

  if (config.tilesetInclude.length) log.info(`TILESET_INCLUDE: ${config.tilesetInclude.join(', ')}`)
  if (config.tilesetExclude.length) log.info(`TILESET_EXCLUDE: ${config.tilesetExclude.join(', ')}`)
  if (Object.keys(config.tilesetAliases).length) log.info(`TILESET_ALIASES: ${Object.entries(config.tilesetAliases).map(([s, a]) => `${a}:${s}`).join(', ')}`)

  const filteredTilesets = filterArtefacts(tilesets, config.tilesetInclude, config.tilesetExclude)
  if (filteredTilesets.length !== tilesets.length) {
    log.info(`filtered to ${filteredTilesets.length} tilesets: ${filteredTilesets.map(t => t._id).join(', ')}`)
  }

  const data: TileserverConfig['data'] = {}
  const tilesetKeys = new Map<string, string>()
  for (const t of filteredTilesets) {
    log.info(`ensuring tileset ${t._id}...`)
    const { downloaded } = await ensureArtefactFile({
      registryUrl: config.registryUrl,
      secretKey: config.registrySecret,
      artefactId: t._id,
      cacheDir: dirs.mbtiles,
      fileName: `${t._id}.mbtiles`
    })
    if (downloaded) log.info(`tileset ${t._id} downloaded`)
    const dataKey = config.tilesetAliases[t._id] ?? stripTilesetPrefix(t._id)
    data[dataKey] = { mbtiles: `${t._id}.mbtiles` }
    tilesetKeys.set(t._id, dataKey)
  }

  if (config.styleInclude.length) log.info(`STYLE_INCLUDE: ${config.styleInclude.join(', ')}`)
  if (config.styleExclude.length) log.info(`STYLE_EXCLUDE: ${config.styleExclude.join(', ')}`)
  if (Object.keys(config.styleAliases).length) log.info(`STYLE_ALIASES: ${Object.entries(config.styleAliases).map(([s, a]) => `${a}:${s}`).join(', ')}`)

  const filteredStyles = filterArtefacts(styles, config.styleInclude, config.styleExclude)
  if (filteredStyles.length !== styles.length) {
    log.info(`filtered to ${filteredStyles.length} styles: ${filteredStyles.map(s => s._id).join(', ')}`)
  }

  const stylesCfg: TileserverConfig['styles'] = {}
  for (const s of filteredStyles) {
    log.info(`ensuring style ${s._id}...`)
    const { path: tarballPath, downloaded } = await ensureArtefactFile({
      registryUrl: config.registryUrl,
      secretKey: config.registrySecret,
      artefactId: s._id,
      cacheDir: styleTarballs,
      fileName: `${s._id}.tgz`
    })
    const styleDir = join(dirs.styles, s._id)
    if (downloaded) {
      log.info(`style ${s._id} downloaded, extracting...`)
      await rm(styleDir, { recursive: true, force: true })
      await mkdir(styleDir, { recursive: true })
      await extractTarball(createReadStream(tarballPath), styleDir)
    }
    const styleName = config.styleAliases[s._id] ?? stylePackageName(s)
    await normalizeStyle({ styleDir, styleName, tilesetKeys })
    const rel = relative(dirs.styles, join(styleDir, 'style.json'))
    stylesCfg[styleName] = { style: rel }
  }

  const tileserverCfg: TileserverConfig = {
    options: {
      paths: dirs,
      serveAllStyles: false,
      serveAllFonts: true,
      formatQuality: { jpeg: 80, webp: 90 }
    },
    styles: stylesCfg,
    data
  }

  await writeFile(join(config.dataDir, 'config.json'), JSON.stringify(tileserverCfg, null, 2))
  log.info(`wrote ${join(config.dataDir, 'config.json')}`)

  return tileserverCfg
}
