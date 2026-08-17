import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('loads the shell and navigates every lazy screen', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/ClaimMoney/)
  await expect(page.getByTestId('app-shell')).toBeVisible()

  for (const tab of ['chart', 'signals', 'microstructure', 'paper', 'settings', 'radar']) {
    const button = page.getByTestId(`tab-${tab}`)
    await button.click()
    await expect(button).toHaveAttribute('aria-current', 'page')
  }
})

test('normalizes a symbol and produces an approved test plan', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('tab-settings').click()
  await expect(page.getByTestId('screen-settings')).toBeVisible()

  await page.getByTestId('symbol-input').fill('eth-usdt')
  await page.getByTestId('symbol-submit').click()
  await expect(page.getByText('ETHUSDT', { exact: true }).first()).toBeVisible()

  await page.getByTestId('inject-buy').click()
  await page.getByTestId('tab-paper').click()
  await expect(page.getByText('ONAYLI TRADE PLANI')).toBeVisible()
  await expect(page.getByTestId('plan-direction')).toHaveText(/LONG|NEUTRAL/)
})
