import { test, expect } from '@playwright/test'
import { anonymousAx } from './support/axios.ts'

test('GET /health returns ok', async () => {
  const res = await anonymousAx.get('/health')
  expect(res.status).toBe(200)
  expect(res.data).toEqual({ status: 'ok' })
})
