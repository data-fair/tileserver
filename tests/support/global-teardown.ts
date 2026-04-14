import { rm } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'

const globalTeardown = async (): Promise<void> => {
  const runtime = globalThis.__TILESERVER_TEST_RUNTIME__
  if (!runtime) return

  try { await runtime.mock.stop() } catch { /* best effort */ }

  const child = runtime.tileserver
  if (!child.killed && child.exitCode === null) {
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))
    child.kill('SIGTERM')
    const timeout = sleep(3000).then(() => 'timeout' as const)
    const result = await Promise.race([exited.then(() => 'exited' as const), timeout])
    if (result === 'timeout' && !child.killed) child.kill('SIGKILL')
  }

  try { await rm(runtime.tmpRoot, { recursive: true, force: true }) } catch { /* best effort */ }

  globalThis.__TILESERVER_TEST_RUNTIME__ = undefined
}

export default globalTeardown
