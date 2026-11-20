import { defineConfig, devices } from '@playwright/test'

// PW_CHROMIUM lets you point at an already-installed Chromium instead of `npx playwright install`.
const executablePath = process.env.PW_CHROMIUM
const launchOptions = executablePath ? { executablePath } : {}

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4180', trace: 'off', launchOptions },
  webServer: {
    command: 'npm run build && npx vite preview --port 4180 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4180',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } }, testIgnore: /mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile/ },
  ],
})
