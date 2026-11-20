import { expect, test } from '@playwright/test'
import { fastNetwork, login } from './helpers'

test('mobile: no horizontal scroll, 44px seats, sticky hold bar', async ({ page }) => {
  await login(page)
  await fastNetwork(page)
  for (const path of ['/events', '/events/neon-monsoon', '/bookings', '/design']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0)
  }
  await page.goto('/events/neon-monsoon')
  const seat = page.locator('.seat-grid .seat').first()
  await expect(seat).toBeVisible()
  const box = await seat.boundingBox()
  expect(box!.width).toBeGreaterThanOrEqual(44)
  expect(box!.height).toBeGreaterThanOrEqual(44)
  await expect(page.locator('.hold-bar')).toBeVisible()
})
