import { createWriteStream } from 'node:fs'
import { readFile, readdir, rm, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'
import sqlite3 from 'sqlite3'
import tarStream from 'tar-stream'

interface RunnableDb {
  run: (sql: string, params?: unknown[]) => Promise<void>
  close: () => Promise<void>
}

const runDb = (db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<void> =>
  new Promise((resolve, reject) => {
    db.run(sql, params, (err) => err ? reject(err) : resolve())
  })

const closeDb = (db: sqlite3.Database): Promise<void> =>
  new Promise((resolve, reject) => {
    db.close((err) => err ? reject(err) : resolve())
  })

const openDb = (path: string): Promise<RunnableDb> => new Promise((resolve, reject) => {
  const db = new sqlite3.Database(path, (err) => {
    if (err) return reject(err)
    resolve({
      run: (sql, params) => runDb(db, sql, params),
      close: () => closeDb(db)
    })
  })
})

export const buildMbtiles = async (destPath: string, tilesetId: string): Promise<void> => {
  await rm(destPath, { force: true })
  const db = await openDb(destPath)
  try {
    await db.run('CREATE TABLE metadata (name TEXT, value TEXT)')
    await db.run('CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB, PRIMARY KEY (zoom_level, tile_column, tile_row))')

    const metadata: Record<string, string> = {
      name: tilesetId,
      type: 'overlay',
      version: '1.0.0',
      description: `Test fixture ${tilesetId}`,
      format: 'pbf',
      minzoom: '0',
      maxzoom: '2',
      bounds: '-180.0,-85.0511,180.0,85.0511',
      center: '0,0,0',
      json: JSON.stringify({
        vector_layers: [
          { id: 'placeholder', description: '', minzoom: 0, maxzoom: 2, fields: {} }
        ]
      })
    }
    for (const [k, v] of Object.entries(metadata)) {
      await db.run('INSERT INTO metadata (name, value) VALUES (?, ?)', [k, v])
    }
  } finally {
    await db.close()
  }
}

export const packStyleTarball = async (sourceDir: string, destPath: string): Promise<void> => {
  const pack = tarStream.pack()

  const walk = async (dir: string): Promise<string[]> => {
    const entries = await readdir(dir, { withFileTypes: true })
    const files: string[] = []
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) files.push(...await walk(full))
      else if (entry.isFile()) files.push(full)
    }
    return files
  }

  const files = await walk(sourceDir)
  // Kick off the write in parallel with pack entries so backpressure works.
  const writePromise = pipeline(pack, createGzip(), createWriteStream(destPath))

  for (const absPath of files) {
    const rel = relative(sourceDir, absPath).split('\\').join('/')
    const name = `package/${rel}`
    const content = await readFile(absPath)
    const st = await stat(absPath)
    await new Promise<void>((resolve, reject) => {
      pack.entry({ name, size: content.length, mode: st.mode }, content, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
  pack.finalize()
  await writePromise
}
