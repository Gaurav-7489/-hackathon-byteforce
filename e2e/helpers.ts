import { expect, type Page } from '@playwright/test'

/** Signs in through the two-step onboarding and lands on the chosen booking page. */
export async function login(page: Page, mode: 'Cinema' | 'Bus' = 'Cinema') {
  await page.goto('/login')
  await page.getByText(mode, { exact: true }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('College email').fill('student@seatlock.dev')
  await page.getByLabel('Password', { exact: true }).fill('seatlock123')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(new RegExp(`/book/${mode.toLowerCase()}`))
}
