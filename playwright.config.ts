import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 45_000,
  use: { baseURL: 'http://127.0.0.1:8787', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 8787',
    url: 'http://127.0.0.1:8787/prepare',
    reuseExistingServer: !process.env.CI,
    env: { WRANGLER_LOG_PATH: '/tmp/noim-test-wrangler-logs' },
  },
})
