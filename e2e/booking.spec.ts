import { expect, test } from '@playwright/test'
import { login } from './helpers'

for (const mode of ['Cinema', 'Bus'] as const) {
  test(`${mode}: pick, lock and pay for seats on the 2D map`, async ({ page }) => {
    await login(page, mode)
    await page.getByRole('button', { name: '2D' }).click()
    const free = page.locator('.bk-cell[data-s="free"]')
    await free.first().click()
    await free.first().click()
    await expect(page.locator('.bk-lines li')).toHaveCount(2)
    await page.getByRole('button', { name: /lock 2 seats/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Seats locked' })).toBeVisible()
    await page.getByRole('button', { name: /^pay ₹/i }).first().click()
    await expect(page.getByText(/^SL-[CB]\d{6}$/)).toBeVisible()
  })
}

test('signed-out visitors are sent to sign in', async ({ page }) => {
  await page.goto('/book/bus')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Where are you headed?' })).toBeVisible()
})
