import { expect, test } from '@playwright/test'
import { login, openFirst } from './helpers'

test('login shows inline validation and a wrong-password message', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('College email').fill('nope')
  await page.getByLabel('Password', { exact: true }).click()
  await expect(page.getByText('That doesn’t look like an email address.')).toBeVisible()
  await page.getByLabel('College email').fill('student@seatlock.dev')
  await page.getByLabel('Password', { exact: true }).fill('wrongpass')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Wrong email or password' })).toBeVisible({ timeout: 15_000 })
})

for (const mode of ['Cinema', 'Bus'] as const) {
  test(`${mode}: pick, hold, confirm, then cancel from My tickets`, async ({ page }) => {
    await login(page, mode)
    await openFirst(page)
    const ids = await page.locator('.seat[data-status="available"]').evaluateAll((els) => els.slice(0, 2).map((e) => e.getAttribute('data-seat')))
    for (const id of ids) await page.locator(`[data-seat="${id}"]`).click()
    await expect(page.locator('.ep-lines li')).toHaveCount(2)
    await page.getByRole('button', { name: /^Hold 2 seats/ }).first().click()
    await expect(page).toHaveURL(/checkout/)
    await expect(page.getByRole('timer')).toBeVisible()
    await page.getByRole('button', { name: /Confirm and pay/ }).click()
    await expect(page).toHaveURL(/success/)
    await expect(page.getByRole('img', { name: 'QR code placeholder for entry' })).toBeVisible()
    await page.getByRole('link', { name: 'View my tickets' }).click()
    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click()
    await expect(page.getByRole('dialog', { name: 'Cancel this booking?' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel booking' }).click()
    await expect(page.getByText('Booking cancelled', { exact: true })).toBeVisible()
  })
}

test('keyboard-only: arrows move, Space selects, a fifth seat is refused', async ({ page }) => {
  await login(page)
  await openFirst(page)
  const first = page.locator('.seat[tabindex="0"]')
  await first.focus()
  let picked = 0
  for (let i = 0; i < 60 && picked < 5; i++) {
    const status = await page.evaluate(() => document.activeElement?.getAttribute('data-status'))
    if (status === 'available') {
      await page.keyboard.press('Space')
      picked++
    }
    await page.keyboard.press('ArrowRight')
  }
  await expect(page.locator('.ep-lines li')).toHaveCount(4)
  await expect(page.getByText('Up to 4 seats per booking').first()).toBeVisible()
})

test('a conflict on hold keeps the other seats and offers a swap', async ({ page }) => {
  await login(page)
  await openFirst(page)
  await page.getByRole('button', { name: 'Demo settings' }).click()
  await page.getByRole('button', { name: 'Conflict on hold' }).click()
  await page.keyboard.press('Escape')
  const ids = await page.locator('.seat[data-status="available"]').evaluateAll((els) => els.slice(0, 2).map((e) => e.getAttribute('data-seat')))
  for (const id of ids) await page.locator(`[data-seat="${id}"]`).click()
  await expect(page.locator('.ep-lines li')).toHaveCount(2)
  await page.getByRole('button', { name: /^Hold 2 seats/ }).first().click()
  const alert = page.locator('.ep-conflict')
  await expect(alert).toBeVisible()
  await expect(alert.getByText(/We kept/)).toBeVisible()
  await expect(alert.getByRole('button', { name: /Swap in/ })).toBeVisible()
})

test('AI assistant suggests seats but never selects them on its own', async ({ page }) => {
  await login(page)
  await openFirst(page)
  await page.getByRole('button', { name: 'Best view' }).click()
  await expect(page.getByRole('button', { name: /Use these seats/ })).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.ep-lines li')).toHaveCount(0)
  await page.getByRole('button', { name: 'Use these seats' }).click()
  await expect(page.locator('.ep-lines li')).not.toHaveCount(0)
})

test('signed-out visitors are sent to sign in', async ({ page }) => {
  await page.goto('/bookings')
  await expect(page).toHaveURL(/\/login/)
})
