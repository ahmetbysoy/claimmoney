import { expect, test } from '@playwright/test'

const productionQa = process.env.PRODUCTION_QA === '1'
test.skip(!productionQa, 'Run with PRODUCTION_QA=1 against an explicit production URL')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('production health, API and live OKX stream are operational', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))

  const health = await request.get('/api/health')
  expect(health.status()).toBe(200)
  expect(await health.json()).toMatchObject({ status: 'ok', service: 'claimmoney' })

  const quote = await request.get('/api/cross-exchange?exchange=okx&symbol=BTCUSDT')
  expect(quote.status()).toBe(200)
  const quoteBody = await quote.json()
  expect(quoteBody.bid).toBeGreaterThan(0)
  expect(quoteBody.ask).toBeGreaterThanOrEqual(quoteBody.bid)

  await page.goto('/')
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-state', 'connected', { timeout: 30_000 })
  await expect.poll(async () => Number(await page.getByTestId('price-ticker').getAttribute('data-price')), { timeout: 30_000 }).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('production can switch source and preserve the responsive shell', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('tab-more').click()
  await page.getByTestId('tab-settings').click()
  await page.getByTestId('source-binance').click()
  await expect(page.getByTestId('source-binance')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-state', 'connected', { timeout: 30_000 })
  await expect(page.getByTestId('app-shell')).toBeVisible()
})
