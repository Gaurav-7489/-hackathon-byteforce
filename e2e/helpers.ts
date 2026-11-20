import { expect, type Page } from '@playwright/test'

export async function login(page: Page) {
  await page.goto('/login')
  // The mock API fails ~1 in 20 requests by design; retry like a user would.
  // React 19 resets the form after a failed action, so re-enter the credentials each time.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByLabel('College email').fill('student@seatlock.dev')
    await page.getByLabel('Password', { exact: true }).fill('seatlock123')
    await page.getByRole('button', { name: /sign in/i }).click()
    const ok = await page.waitForURL(/\/events/, { timeout: 12_000 }).then(() => true, () => false)
    if (ok) return
  }
  await expect(page).toHaveURL(/\/events/)
}

/** Presenter controls (mock mode) — makes the demo edge cases deterministic. */
export async function demo(page: Page, label: RegExp) {
  await page.getByRole('button', { name: 'Demo controls' }).click()
  await page.getByRole('button', { name: label }).click()
  await page.getByRole('button', { name: 'Demo controls' }).click()
}

export async function fastNetwork(page: Page) {
  await page.getByRole('button', { name: 'Demo controls' }).click()
  await page.getByLabel(/fast network/i).check()
  await page.getByLabel(/random failures/i).uncheck()
  await page.getByRole('button', { name: 'Demo controls' }).click()
}
