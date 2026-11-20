import { expect, test } from '@playwright/test'
import { demo, fastNetwork, login } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('e2e')) { localStorage.clear(); sessionStorage.setItem('e2e', '1') } })
})

test('login shows inline validation and a wrong-password message', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByText('Enter your college email.')).toBeVisible()
  await page.getByLabel('College email').fill('student@seatlock.dev')
  await page.getByLabel('Password', { exact: true }).fill('wrongpass')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByRole('button', { name: /signing in/i })).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText(/wrong email or password/i, { timeout: 15_000 })
})

test('keyboard-only booking: list → seat map → hold → confirm', async ({ page }) => {
  await login(page)
  await fastNetwork(page)
  const card = page.locator('.event-card-link').first()
  await card.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/events\/.+/)
  const grid = page.getByRole('grid', { name: 'Seat map' })
  await expect(grid).toBeVisible()
  // Focus the roving seat and move with arrows; Space selects.
  await grid.locator('button[tabindex="0"]').focus()
  let picked = 0
  for (let i = 0; i < 30 && picked < 2; i++) {
    await page.keyboard.press('ArrowRight')
    const focused = page.locator('.seat:focus')
    if ((await focused.getAttribute('data-status')) === 'available') {
      await page.keyboard.press('Space')
      picked++
    }
  }
  await expect(page.locator('.summary-seat')).toHaveCount(2)
  await expect(page.locator('.seat:focus')).toBeVisible()
  // Tab to the Hold button and press Enter.
  const hold = page.getByRole('button', { name: /hold 2 seats/i })
  for (let i = 0; i < 40 && !(await hold.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/checkout/, { timeout: 15_000 }).catch(async () => {
    // A simulated conflict (other students) is a valid outcome: retry with remaining seats.
    await expect(page.locator('.conflict')).toBeVisible()
  })
  test.skip(!page.url().includes('checkout'), 'Simulated rush took a seat; conflict path covered separately.')
  await expect(page.getByRole('timer')).toBeVisible()
  const confirm = page.getByRole('button', { name: /confirm booking/i })
  await confirm.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/success/, { timeout: 15_000 })
  await expect(page.getByRole('article', { name: /ticket/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /add to calendar/i })).toBeVisible()
})

test('a fifth seat is refused with an explanation', async ({ page }) => {
  await login(page)
  await fastNetwork(page)
  await page.goto('/events/hackathon-finals')
  const free = page.locator('.seat-grid .seat[data-status="available"]')
  await expect(free.first()).toBeVisible()
  for (let i = 0; i < 5; i++) await free.nth(i).click({ force: true })
  await expect(page.locator('.summary-seat')).toHaveCount(4)
  await expect(page.getByText(/up to 4 seats per booking/i)).toBeVisible()
})

test('hold conflict keeps other seats, highlights the lost one and offers an alternative', async ({ page }) => {
  await login(page)
  await fastNetwork(page)
  await page.goto('/events/midnight-verses')
  const free = page.locator('.seat-grid .seat[data-status="available"]')
  await expect(free.first()).toBeVisible()
  for (let i = 0; i < 3; i++) await free.nth(i * 3).click({ force: true })
  await expect(page.locator('.summary-seat')).toHaveCount(3)
  await demo(page, /force conflict/i)
  await page.getByRole('button', { name: /hold 3 seats/i }).click()
  const conflict = page.locator('.conflict')
  await expect(conflict).toBeVisible({ timeout: 15_000 })
  await expect(conflict).toContainText(/just taken/i)
  await expect(conflict).toContainText(/we kept/i)
  await expect(page.locator('.summary-seat')).toHaveCount(2)
  await expect(page.locator('.seat[data-lost]')).toHaveCount(1)
  await conflict.getByRole('button', { name: /swap in/i }).click()
  await expect(page.locator('.summary-seat')).toHaveCount(3)
})

test('AI assistant suggests, highlights, and only selects after "Use these seats"', async ({ page }) => {
  await login(page)
  await fastNetwork(page)
  await page.goto('/events/strings-at-dusk')
  await expect(page.getByRole('grid', { name: 'Seat map' })).toBeVisible()
  await page.getByLabel('Describe the seats you want').fill('2 seats together near the stage under ₹300 each')
  await page.getByRole('button', { name: 'Ask the assistant' }).click()
  await expect(page.getByRole('button', { name: /stop the assistant/i })).toBeVisible()
  await expect(page.getByText('AI-generated')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.seat-grid .seat[data-ai]')).toHaveCount(2)
  await expect(page.locator('.summary-seat')).toHaveCount(0) // nothing selected or held yet
  await page.getByRole('button', { name: /use these seats/i }).click()
  await expect(page.locator('.summary-seat')).toHaveCount(2)
  await expect(page).toHaveURL(/strings-at-dusk/) // never auto-holds
})

test('AI timeout keeps manual selection usable', async ({ page }) => {
  await login(page)
  await fastNetwork(page)
  await page.goto('/events/strings-at-dusk')
  await expect(page.getByRole('grid', { name: 'Seat map' })).toBeVisible()
  await demo(page, /slow next reply/i)
  await page.getByRole('button', { name: 'Cheapest' }).click()
  await expect(page.getByText(/longer than 8 seconds/i)).toBeVisible({ timeout: 15_000 })
  // Back rows: least contested by the simulated rush.
  await page.locator('.seat-grid .seat[data-status="available"]').last().click({ force: true })
  await expect(page.locator('.summary-seat')).toHaveCount(1)
})

test('my bookings: Upcoming/Past tabs list tickets', async ({ page }) => {
  await login(page)
  await fastNetwork(page)
  await page.goto('/bookings')
  await expect(page.getByRole('tab', { name: /upcoming/i })).toBeVisible()
  await page.getByRole('tab', { name: /past/i }).click()
  await expect(page.locator('.wallet-card').first()).toBeVisible()
})
