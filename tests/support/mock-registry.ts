import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import express, { type Request, type Response, type NextFunction } from 'express'
import eventPromise from '@data-fair/lib-utils/event-promise.js'
import type { Artefact } from '../../src/registry-client.ts'

export interface MockArtefact extends Artefact {
  /** Absolute path on disk to the bytes served by GET /download. */
  filePath: string
  contentType: string
}

export interface StartMockRegistryOpts {
  secret: string
  artefacts: MockArtefact[]
  /** Optional, mainly for debugging — fixed port instead of ephemeral. */
  port?: number
}

export interface MockRegistryHandle {
  url: string
  stop: () => Promise<void>
}

export const startMockRegistry = async (opts: StartMockRegistryOpts): Promise<MockRegistryHandle> => {
  const app = express()

  const requireSecret = (req: Request, res: Response, next: NextFunction): void => {
    if (req.headers['x-secret-key'] !== opts.secret) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
    next()
  }

  app.get('/api/v1/artefacts', requireSecret, (req, res) => {
    const { category, format } = req.query
    let filtered = opts.artefacts
    if (typeof category === 'string') filtered = filtered.filter(a => a.category === category)
    if (typeof format === 'string') filtered = filtered.filter(a => a.format === format)
    const size = Number(req.query.size ?? 100)
    const skip = Number(req.query.skip ?? 0)
    const results = filtered.slice(skip, skip + size).map(({ filePath, contentType, ...rest }) => rest)
    res.json({ results, count: filtered.length })
  })

  app.get('/api/v1/artefacts/:id/download', requireSecret, async (req, res, next) => {
    try {
      const artefact = opts.artefacts.find(a => a._id === req.params.id)
      if (!artefact) {
        res.status(404).json({ error: 'artefact not found' })
        return
      }
      const st = await stat(artefact.filePath)
      const mtimeSec = Math.floor(st.mtime.getTime() / 1000)

      const ims = req.headers['if-modified-since']
      if (typeof ims === 'string') {
        const sinceMs = Date.parse(ims)
        if (!Number.isNaN(sinceMs) && mtimeSec <= Math.floor(sinceMs / 1000)) {
          res.status(304).end()
          return
        }
      }

      res.setHeader('Last-Modified', new Date(mtimeSec * 1000).toUTCString())
      res.setHeader('Content-Type', artefact.contentType)
      res.setHeader('Content-Length', st.size.toString())
      createReadStream(artefact.filePath).pipe(res)
    } catch (err) {
      next(err)
    }
  })

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: err.message })
  })

  const server: Server = createServer(app)
  server.listen(opts.port ?? 0)
  await eventPromise(server, 'listening')

  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('mock registry failed to bind')
  const url = `http://127.0.0.1:${address.port}`

  return {
    url,
    stop: () => new Promise<void>((resolve, reject) => {
      server.close((err) => err ? reject(err) : resolve())
    })
  }
}
