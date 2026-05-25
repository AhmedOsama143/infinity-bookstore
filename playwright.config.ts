import { defineConfig, devices } from '@playwright/test';

// Spawn the local dev server for the smoke run. CI will swap to a built
// production server via PLAYWRIGHT_USE_BUILD=1.
const useBuild = process.env.PLAYWRIGHT_USE_BUILD === '1';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html']] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Most of the storefront is Arabic; force the browser to advertise that
    // so any locale-conditioned UI behaves the same as in production.
    locale: 'ar-EG',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  // Boot the server unless an external one is targeted via PLAYWRIGHT_BASE_URL.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: useBuild ? 'npm run build && npm run start' : 'npm run dev',
        url: 'http://localhost:3000',
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
      },
});
