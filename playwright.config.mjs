import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './tests/architecture',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', {open: 'never'}]],
  use: {
    browserName: 'chromium',
    // Local fallback when the Playwright browser CDN is unavailable.
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {name: 'desktop', use: {viewport: {width: 1280, height: 900}}},
    {name: 'wide', use: {viewport: {width: 1600, height: 1000}}},
    {name: 'mobile', use: {viewport: {width: 390, height: 844}}},
  ],
});
