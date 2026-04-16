import { test, expect } from '@playwright/test'
import { axiosBuilder } from '@data-fair/lib-node/axios.js'

// Health is served at root level, not under basePath
const rootAx = axiosBuilder({ baseURL: process.env.TEST_TILESERVER_URL ?? '' })

test('GET /health returns ok', async () => {
  const res = await rootAx.get('/health')
  expect(res.status).toBe(200)
  expect(res.data).toEqual({ status: 'ok' })
})
