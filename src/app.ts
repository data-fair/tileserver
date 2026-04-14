import express, { type Express, type Request, type Response, type NextFunction } from 'express'
import helmet from 'helmet'
// @ts-expect-error no types shipped with tileserver-gl-light
import tileserverGl from 'tileserver-gl-light'
import config from '#config'
import log from '#log'
import { buildTileserverConfig } from './build-config.ts'

export const createApp = async (): Promise<Express> => {
  const tileserverConfig = await buildTileserverConfig()

  const tsApp: Express = await tileserverGl({
    config: tileserverConfig,
    publicUrl: config.publicUrl,
    port: config.port
  })

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
