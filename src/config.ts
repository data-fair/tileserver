import { z } from 'zod'
import { parseList, parseAliases } from './config-parse.ts'

const EnvSchema = z.object({
  REGISTRY_URL: z.string().url(),
  REGISTRY_SECRET: z.string().min(1),
  DATA_DIR: z.string().default('/data'),
  FONTS_DIR: z.string().default('/app/fonts'),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  OBSERVER_ACTIVE: z.enum(['true', 'false']).default('true').transform(v => v === 'true'),
  OBSERVER_PORT: z.coerce.number().int().positive().default(9090),
  TILESET_INCLUDE: z.string().default('').transform(parseList),
  TILESET_EXCLUDE: z.string().default('').transform(parseList),
  TILESET_ALIASES: z.string().default('').transform(parseAliases),
  STYLE_INCLUDE: z.string().default('').transform(parseList),
  STYLE_EXCLUDE: z.string().default('').transform(parseList),
  STYLE_ALIASES: z.string().default('').transform(parseAliases),
})

const parsed = EnvSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment configuration:')
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

const env = parsed.data

const config = {
  registryUrl: env.REGISTRY_URL,
  registrySecret: env.REGISTRY_SECRET,
  dataDir: env.DATA_DIR,
  fontsDir: env.FONTS_DIR,
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
  observer: {
    active: env.OBSERVER_ACTIVE,
    port: env.OBSERVER_PORT
  },
  tilesetInclude: env.TILESET_INCLUDE,
  tilesetExclude: env.TILESET_EXCLUDE,
  tilesetAliases: env.TILESET_ALIASES,
  styleInclude: env.STYLE_INCLUDE,
  styleExclude: env.STYLE_EXCLUDE,
  styleAliases: env.STYLE_ALIASES,
} as const

export default config
export type Config = typeof config
