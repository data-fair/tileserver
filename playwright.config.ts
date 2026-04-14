import { defineConfig } from '@playwright/test'
import 'dotenv/config'

export default defineConfig({
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:' + process.env.DEV_PORT,
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
