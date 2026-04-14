import { z } from 'zod'

const EnvSchema = z.object({
  REGISTRY_URL: z.string().url(),
  REGISTRY_SECRET: z.string().min(1),
  DATA_DIR: z.string().default('/data'),
  FONTS_DIR: z.string().default('/app/fonts'),
  PUBLIC_URL: z.string().url().optional(),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  ARTEFACTS_PAGE_SIZE: z.coerce.number().int().positive().default(100),
  OBSERVER_ACTIVE: z.coerce.boolean().default(true),
  OBSERVER_PORT: z.coerce.number().int().positive().default(9090)
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
  publicUrl: env.PUBLIC_URL,
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
  artefactsPageSize: env.ARTEFACTS_PAGE_SIZE,
  observer: {
    active: env.OBSERVER_ACTIVE,
    port: env.OBSERVER_PORT
  }
} as const

export default config
export type Config = typeof config
