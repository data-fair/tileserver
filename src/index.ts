import log from '#log'
import { start, stop } from './server.ts'

start().then(() => {}, err => {
  log.error('failure while starting service', err)
  process.exit(1)
})

const shutdown = (signal: string) => {
  log.info(`received ${signal}, shutting down gracefully...`)
  stop().then(() => {
    log.info('shutdown complete')
    process.exit()
  }, err => {
    log.error('failure while stopping service', err)
    process.exit(1)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
