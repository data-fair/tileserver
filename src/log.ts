import config from '#config'

const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50 } as const
type Level = keyof typeof LEVELS

const threshold = LEVELS[config.logLevel]

const emit = (level: Level, args: unknown[]) => {
  if (LEVELS[level] < threshold) return
  const ts = new Date().toISOString()
  const prefix = `${ts} ${level.toUpperCase()}`
  if (level === 'error' || level === 'warn') console.error(prefix, ...args)
  else console.log(prefix, ...args)
}

const log = {
  trace: (...args: unknown[]) => emit('trace', args),
  debug: (...args: unknown[]) => emit('debug', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args)
}

export default log
