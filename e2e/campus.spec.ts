import { expect, test, type Page } from '@playwright/test'
import { demo, fastNetwork, login } from './helpers'

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByLabel('College email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()
    if (await page.waitForURL(/\/events/, { timeout: 12_000 }).then(() => true, () => false)) return
  }
}

test('buddy seating recommends, highlights, and selects only after approval (never holds)', async ({ page }) => {
  await login(page)
  await page.goto('/events/neon-monsoon')
  await expect(page.getByRole('grid', { name: 'Seat map' })).toBeVisible()
  const tools = page.getByRole('region', { name: /smart seat tools/i })
  await tools.getByRole('button', { name: /show on map/i }).first().click()
  await expect(page.locator('.seat-grid .seat[data-rec]')).toHaveCount(4)
  await expect(page.locator('.summary-seat')).toHaveCount(0) // highlighting never selects
  await tools.getByRole('button', { name: /select these seats/i }).first().click()
  await expect(page.locator('.summary-seat')).toHaveCount(4)
  await expect(page.getByRole('button', { name: /hold 4 seats/i }).first()).toBeVisible()
  await expect(page).toHaveURL(/\/events\/neon-monsoon/) // nothing was held
})

test('accessibility tool only offers organizer-listed wheelchair spaces', async ({ page }) => {
  await login(page)
  await page.goto('/events/retro-orchestra')
  await expect(page.getByRole('grid', { name: 'Seat map' })).toBeVisible()
  const tools = page.getByRole('region', { name: /smart seat tools/i })
  await tools.getByRole('tab', { name: /access/i }).click()
  await tools.getByRole('switch', { name: 'Wheelchair space' }).check({ force: true })
  await expect(tools.getByText(/designated wheelchair space|all designated wheelchair spaces are taken/i).first()).toBeVisible()
  await expect(page.locator('.seat[data-marker="wheelchair"]').first()).toBeVisible()
})

test('high-demand event goes through the FairQueue waiting room', async ({ page }) => {
  await login(page)
  await page.goto('/events/synthwave-convocation')
  await expect(page.getByRole('heading', { name: /fairqueue/i })).toBeVisible()
  await expect(page.getByText(/your position/i)).toBeVisible()
  await page.getByRole('button', { name: /skip to the front/i }).click()
  await expect(page.getByRole('grid', { name: 'Seat map' })).toBeVisible()
  await expect(page.getByText(/fairqueue pass/i)).toBeVisible()
})

test('schedule clash is flagged on the event page', async ({ page }) => {
  await login(page)
  await page.goto('/schedule')
  await page.getByRole('radio', { name: 'Commitment' }).click()
  await page.getByLabel('Name').fill('Lab report deadline')
  await page.getByLabel('Starts').fill('18:30')
  await page.getByLabel('Ends').fill('19:30')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText('Lab report deadline').first()).toBeVisible()
  await page.goto('/events/neon-monsoon') // tonight, 7 pm
  await expect(page.getByRole('alert').filter({ hasText: /clashes with your schedule/i })).toBeVisible()
})

test('waitlist: join a sold-out event, receive an offer, accept into checkout', async ({ page }) => {
  test.setTimeout(150_000)
  await login(page)
  await page.goto('/events/campus-unplugged')
  await expect(page.getByRole('grid', { name: 'Seat map' })).toBeVisible()
  await page.getByRole('button', { name: 'Join for 1 seat' }).click()
  await page.goto('/waitlist')
  await fastNetwork(page)
  const accept = page.getByRole('button', { name: /accept & go to checkout/i })
  for (let i = 0; i < 12 && !(await accept.isVisible()); i++) {
    await page.getByRole('button', { name: /simulate a cancellation/i }).click()
    await accept.waitFor({ timeout: 9_000 }).catch(() => {})
  }
  await expect(accept).toBeVisible()
  await expect(page.getByRole('timer')).toBeVisible()
  await accept.click()
  await expect(page).toHaveURL(/\/checkout/)
  await expect(page.getByRole('button', { name: /confirm booking/i })).toBeVisible()
})

test('organizer dashboards: overview, twin, no-show release and load lab', async ({ page }) => {
  await loginAs(page, 'organizer@seatlock.dev', 'organizer123')
  await page.goto('/organizer?event=neon-monsoon')
  await expect(page.getByText('Capacity')).toBeVisible()
  await expect(page.getByText('Hold conflicts')).toBeVisible()
  await page.getByRole('button', { name: 'Digital twin' }).click()
  await expect(page.getByRole('img', { name: /seating grid/i })).toBeVisible()
  await page.getByRole('button', { name: 'No-shows' }).click()
  await page.getByLabel(/event clock/i).fill('30')
  const release = page.getByRole('button', { name: /^release \d+ seats/i })
  await expect(release).toBeEnabled()
  await release.click()
  await expect(page.getByText(/recovered capacity/i)).toBeVisible()
  await page.getByRole('button', { name: 'Load lab' }).click()
  await expect(page.getByText(/fairqueue vs first-come/i)).toBeVisible()
  await expect(page.getByRole('list', { name: /fairqueue success by connection/i })).toBeVisible()
})

test('booking → verified return routes seats and records history', async ({ page }) => {
  await login(page)
  await page.goto('/events/strings-at-dusk')
  const free = page.locator('.seat-grid .seat[data-status="available"]')
  await expect(free.first()).toBeVisible()
  await fastNetwork(page) // no random 503s: holds are deliberately never auto-retried
  await free.nth(2).click({ force: true })
  await expect(page.locator('.summary-seat')).toHaveCount(1)
  await page.getByRole('button', { name: /hold 1 seat/i }).first().click()
  const confirm = page.getByRole('button', { name: /confirm booking/i })
  await expect(confirm).toBeVisible({ timeout: 20_000 })
  for (let i = 0; i < 3 && !/success/.test(page.url()); i++) {
    await confirm.click()
    await page.waitForURL(/success/, { timeout: 12_000 }).catch(() => {})
  }
  await expect(page.getByRole('link', { name: /saved for offline/i })).toBeVisible()
  await page.goto('/bookings')
  await page.getByRole('button', { name: /return tickets for strings at dusk/i }).first().click()
  await expect(page.getByText(/demo credit/i)).toBeVisible()
  await page.getByRole('button', { name: 'Return ticket' }).click()
  await expect(page.getByRole('heading', { name: 'Exchange history' })).toBeVisible({ timeout: 20_000 })
})

test('offline vault shows saved tickets with no network', async ({ page, context }) => {
  await login(page)
  await page.goto('/tickets')
  await expect(page.getByText(/not proof of entry/i)).toBeVisible()
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await expect(page.getByText(/offline — showing tickets saved on this device/i)).toBeVisible()
  await context.setOffline(false)
})

test('demo controls still drive the conflict flow with ranked rescue options', async ({ page }) => {
  await login(page)
  await page.goto('/events/midnight-verses')
  const free = page.locator('.seat-grid .seat[data-status="available"]')
  await expect(free.first()).toBeVisible()
  await free.nth(0).click({ force: true })
  await free.nth(4).click({ force: true })
  await demo(page, /force conflict/i)
  await page.getByRole('button', { name: /hold 2 seats/i }).first().click()
  const conflict = page.locator('.conflict')
  await expect(conflict).toBeVisible({ timeout: 15_000 })
  await expect(conflict.locator('.rescue-why').first()).toContainText(/(same price|more|cheaper)/)
})
