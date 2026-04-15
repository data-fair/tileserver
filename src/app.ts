import { type Server } from 'node:http'
import express, { type Express, type Request, type Response, type NextFunction } from 'express'
import helmet from 'helmet'
// @ts-expect-error no types shipped with tileserver-gl-light
import { server as tileserverGl } from 'tileserver-gl-light/src/server.js'
import log from '#log'
import { buildTileserverConfig } from './build-config.ts'

interface TileserverRunning {
  app: Express
  server: Server
  startupPromise: Promise<unknown>
}

export const createApp = async (): Promise<Express> => {
  const tileserverConfig = await buildTileserverConfig()

  // tileserver-gl-light's `server()` both builds the express app AND calls `.listen()` on
  // an internal http server — there is no "just give me the app" entry point. We bind it to
  // an ephemeral port, wait for its async init, then close the inner socket and reuse the
  // still-fully-wired express app as middleware under our own outer http server.
  const running = await (tileserverGl({
    config: tileserverConfig,
    port: 0,
    silent: true
  }) as Promise<TileserverRunning>)
  await running.startupPromise
  await new Promise<void>((resolve, reject) => {
    running.server.close((err) => err ? reject(err) : resolve())
  })
  const tsApp = running.app

  const app = express()

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'img-src': ["'self'", 'data:', 'blob:'],
        'worker-src': ["'self'", 'blob:'],
        'child-src': ["'self'", 'blob:']
      }
    },
    crossOriginEmbedderPolicy: false
  }))
  app.disable('x-powered-by')

  app.get('/health', (_req, res) => res.json({ status: 'ok' }))

  app.use(tsApp)

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    log.error('unhandled request error', err)
    res.status(500).json({ error: 'internal error' })
  })

  return app
}
