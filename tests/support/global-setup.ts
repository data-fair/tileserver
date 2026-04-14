import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { createWriteStream, openSync, closeSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import { startMockRegistry, type MockArtefact, type MockRegistryHandle } from './mock-registry.ts'
import { buildMbtiles, packStyleTarball } from './fixtures.ts'

export interface TestRuntime {
  tmpRoot: string
  logPath: string
  mock: MockRegistryHandle
  tileserver: ChildProcess
  tileserverUrl: string
}

declare global {
  var __TILESERVER_TEST_RUNTIME__: TestRuntime | undefined
}

const thisDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(thisDir, '../..')

const pickFreePort = async (): Promise<number> => {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('failed to pick free port')
  const port = address.port
  await new Promise<void>((resolve) => server.close(() => resolve()))
  return port
}

const waitForHealth = async (url: string, logPath: string, timeoutMs = 20000): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url + '/health')
      if (res.ok) return
    } catch { /* not up yet */ }
    await sleep(200)
  }
  throw new Error(`tileserver did not become healthy within ${timeoutMs}ms. See ${logPath}`)
}

const globalSetup = async (): Promise<void> => {
  const tmpRoot = await mkdtemp(join(tmpdir(), 'tileserver-test-'))
  const dataDir = join(tmpRoot, 'data')
  const fontsDir = join(tmpRoot, 'fonts')
  const fixturesDir = join(tmpRoot, 'fixtures')
  await mkdir(dataDir, { recursive: true })
  await mkdir(fontsDir, { recursive: true })
  await mkdir(fixturesDir, { recursive: true })

  const tilesetId = 'tileset-world'
  const mbtilesPath = join(fixturesDir, `${tilesetId}.mbtiles`)
  await buildMbtiles(mbtilesPath, tilesetId)

  const styleSourceDir = join(repoRoot, 'tests/fixtures/registry/style-basic')
  const styleTarballPath = join(fixturesDir, 'style-basic.tgz')
  await packStyleTarball(styleSourceDir, styleTarballPath)

  const artefacts: MockArtefact[] = [
    {
      _id: tilesetId,
      name: tilesetId,
      category: 'tileset',
      format: 'file',
      filePath: mbtilesPath,
      contentType: 'application/octet-stream'
    },
    {
      _id: 'style-basic',
      name: 'basic',
      category: 'maplibre-style',
      format: 'file',
      filePath: styleTarballPath,
      contentType: 'application/gzip'
    }
  ]

  const secret = 'test-secret'
  const mock = await startMockRegistry({ secret, artefacts })

  const tileserverPort = await pickFreePort()
  const tileserverUrl = `http://127.0.0.1:${tileserverPort}`

  const logDir = join(repoRoot, 'dev/logs')
  await mkdir(logDir, { recursive: true })
  const logPath = join(logDir, 'test-tileserver.log')
  // Truncate previous run's log
  closeSync(openSync(logPath, 'w'))
  const logStream = createWriteStream(logPath, { flags: 'a' })

  const tileserver = spawn('node', ['src/index.ts'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      REGISTRY_URL: mock.url,
      REGISTRY_SECRET: secret,
      PORT: String(tileserverPort),
      DATA_DIR: dataDir,
      FONTS_DIR: fontsDir,
      OBSERVER_ACTIVE: 'false',
      LOG_LEVEL: 'info',
      NODE_ENV: 'test'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  tileserver.stdout?.pipe(logStream)
  tileserver.stderr?.pipe(logStream)

  const exitPromise = new Promise<never>((_resolve, reject) => {
    tileserver.once('exit', (code, signal) => {
      reject(new Error(`tileserver exited before becoming healthy (code=${code}, signal=${signal}). See ${logPath}`))
    })
  })

  try {
    await Promise.race([waitForHealth(tileserverUrl, logPath), exitPromise])
  } catch (err) {
    try { await mock.stop() } catch { /* best effort */ }
    if (!tileserver.killed) tileserver.kill('SIGKILL')
    await rm(tmpRoot, { recursive: true, force: true })
    throw err
  }

  process.env.TEST_TILESERVER_URL = tileserverUrl

  globalThis.__TILESERVER_TEST_RUNTIME__ = {
    tmpRoot,
    logPath,
    mock,
    tileserver,
    tileserverUrl
  }
}

export default globalSetup
