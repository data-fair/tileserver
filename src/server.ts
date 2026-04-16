import { createServer, type Server } from 'node:http'
import { startObserver, stopObserver } from '@data-fair/lib-node/observer.js'
import eventPromise from '@data-fair/lib-utils/event-promise.js'
import { createHttpTerminator, type HttpTerminator } from 'http-terminator'
import { createApp } from './app.ts'
import config from '#config'
import log from '#log'

let server: Server | undefined
let httpTerminator: HttpTerminator | undefined

export const start = async () => {
  if (config.observer.active) await startObserver(config.observer.port)

  const app = await createApp()
  server = createServer(app)
  httpTerminator = createHttpTerminator({ server })

  server.keepAliveTimeout = (60 * 1000) + 1000
  server.headersTimeout = (60 * 1000) + 2000

  server.listen(config.port)
  await eventPromise(server, 'listening')

  log.info(`tileserver listening on port ${config.port}${config.basePath ? `, basePath=${config.basePath}` : ''}`)
}

export const stop = async () => {
  if (httpTerminator) await httpTerminator.terminate()
  if (config.observer.active) await stopObserver()
}
