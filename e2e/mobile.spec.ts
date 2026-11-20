import { expect, test } from '@playwright/test'
import { login, openFirst } from './helpers'

test('phone: 44px seat targets, no horizontal scroll, sticky hold bar', async ({ page }) => {
  await login(page, 'Bus')
  await openFirst(page)
  const box = await page.locator('.seat').first().boundingBox()
  expect(box!.width).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.locator('.seat[data-status="available"]').first().click()
  await expect(page.locator('.ep-holdbar').getByRole('button', { name: /^Hold 1 seat/ })).toBeVisible()
})
