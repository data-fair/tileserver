import { defineConfig } from '@playwright/test'
import 'dotenv/config'

export default defineConfig({
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',

  globalSetup: './tests/support/global-setup.ts',
  globalTeardown: './tests/support/global-teardown.ts',

  use: {
    baseURL: process.env.TEST_TILESERVER_URL,
    trace: 'on-first-retry'
  },

  projects: [
    {
      name: 'unit',
      testMatch: /.*\.unit\.spec\.ts/
    },
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/
    }
  ]
})
