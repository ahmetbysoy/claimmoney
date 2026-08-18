import { expect, test, type Page } from '@playwright/test'

const secondaryTabs = new Set(['microstructure', 'research', 'settings'])
async function navigateTo(page: Page, tab: string) {
  if (secondaryTabs.has(tab)) await page.getByTestId('tab-more').click()
  await page.getByTestId(`tab-${tab}`).click()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('loads the shell and navigates every lazy screen', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/ClaimMoney/)
  await expect(page.getByTestId('app-shell')).toBeVisible()

  for (const tab of ['chart', 'signals', 'microstructure', 'paper', 'research', 'settings', 'radar']) {
    await navigateTo(page, tab)
    await expect(page.getByTestId(`screen-${tab}`)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  }
})

test('uses four primary destinations and an accessible secondary drawer', async ({ page }) => {
  await page.goto('/')
  const primary = page.locator('.primary-nav .nav-button')
  await expect(primary).toHaveCount(5)
  for (const tab of ['radar', 'chart', 'signals', 'paper']) await expect(page.getByTestId(`tab-${tab}`)).toBeVisible()
  await expect(page.getByTestId('tab-settings')).toHaveCount(0)

  const more = page.getByTestId('tab-more')
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await more.click()
  await expect(more).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('dialog', { name: 'İkincil görünümler' })).toBeVisible()
  await expect(page.getByTestId('tab-microstructure')).toBeVisible()
  await expect(page.getByTestId('tab-research')).toBeVisible()
  await expect(page.getByTestId('tab-settings')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'İkincil görünümler' })).toHaveCount(0)

  await page.getByTestId('tab-chart').focus()
  await expect(page.getByTestId('tab-chart')).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('normalizes a symbol and produces an approved test plan', async ({ page }) => {
  await page.goto('/')
  await navigateTo(page, 'settings')
  await expect(page.getByTestId('screen-settings')).toBeVisible()

  await page.getByTestId('symbol-input').fill('eth-usdt')
  await page.getByTestId('symbol-submit').click()
  await expect(page.getByTestId('symbol-input')).toHaveValue('ETHUSDT')

  await page.getByTestId('inject-buy').click()
  await page.getByTestId('tab-paper').click()
  await expect(page.getByText('ONAYLI TRADE PLANI')).toBeVisible()
  await expect(page.getByTestId('plan-direction')).toHaveText(/LONG|NEUTRAL/)
})

test('exports sessions and imports both session JSON and replay JSONL', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('tab-paper').click()

  const sessionDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Oturum JSON' }).click()
  expect((await sessionDownload).suggestedFilename()).toMatch(/claimmoney-.*\.json/)

  const recordingDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Kayıt JSONL' }).click()
  expect((await recordingDownload).suggestedFilename()).toMatch(/claimmoney-events-.*\.jsonl/)

  const input = page.getByTestId('import-replay-input')
  await input.setInputFiles({
    name: 'session.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      version: 1, sessionId: 'e2e-session', symbol: 'BTCUSDT', strategyVersion: 'e2e',
      startedAt: 1_000, endedAt: 2_000, payload: { signals: [] }
    }))
  })
  await expect(page.getByText(/Oturum içe aktarıldı: e2e-session/)).toBeVisible()

  const events = [
    { kind: 'bookSnapshot', exchange: 'okx', symbol: 'BTCUSDT', eventTs: 1_000, receiveTs: 1_001, seq: 1,
      bids: [[50_000, 2]], asks: [[50_001, 2]] },
    { kind: 'markPrice', exchange: 'okx', symbol: 'BTCUSDT', eventTs: 1_100, receiveTs: 1_101, price: 50_000.5, priceStr: '50000.5' }
  ]
  const replayDownload = page.waitForEvent('download')
  await input.setInputFiles({
    name: 'recording.jsonl', mimeType: 'application/x-ndjson',
    buffer: Buffer.from(events.map(event => JSON.stringify(event)).join('\n'))
  })
  expect((await replayDownload).suggestedFilename()).toMatch(/claimmoney-replay-.*\.json/)
  await expect(page.getByText(/Replay tamamlandı: 2 işlendi, 0 reddedildi/)).toBeVisible()

  await navigateTo(page, 'research')
  await expect(page.getByTestId('screen-research')).toBeVisible()
  const datasetDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Dataset dışa aktar' }).click()
  expect((await datasetDownload).suggestedFilename()).toMatch(/claimmoney-research-.*\.json/)
  await page.getByTestId('research-import-input').setInputFiles({
    name: 'dataset.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, observations: [] }))
  })
  await expect(page.getByText(/0 gözlem içe aktarıldı/)).toBeVisible()
})
