import { expect, type Page } from '@playwright/test'

/** Fast, deterministic demo settings, then sign in through the two-step flow. */
export async function login(page: Page, mode: 'Cinema' | 'Bus' = 'Cinema') {
  await page.goto('/login')
  await page.evaluate(() => {
    localStorage.setItem('seatlock-demo', JSON.stringify({ live: false, people: true, fast: true, failures: false }))
    localStorage.setItem('seatlock-view', 'map')
  })
  await page.reload()
  await page.getByText(mode, { exact: true }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('College email').fill('student@seatlock.dev')
  await page.getByLabel('Password', { exact: true }).fill('seatlock123')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(new RegExp(`/book/${mode.toLowerCase()}`))
}

export async function openFirst(page: Page) {
  await page.locator('.ev-card a').first().click()
  await expect(page).toHaveURL(/\/e\//)
  await expect(page.getByRole('grid', { name: 'Seat map' })).toBeVisible()
  // The listing header resolves separately and can shift the map; wait for it.
  await expect(page.getByText('AI summary')).toBeVisible()
}
